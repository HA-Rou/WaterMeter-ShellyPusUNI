/**
 * Shelly Plus UNI - Water Meter, Multi-Channel Telegram & Leak Detection
 * 
 * Documentation des fonctions Shelly utilisées :
 * - Shelly.addStatusHandler : Écoute les deltas de statut (ex: incrément du compteur input:2).
 * - Shelly.call             : Exécute une commande RPC (Switch.Set, KVS.Get, HTTP.Request, Sys.GetStatus).
 * - Timer.set                : Crée des temporisateurs non-bloquants (timers).
 * - JSON.parse / stringify   : Sérialise et désérialise les objets JSON dans l'environnement mJS.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================
let CONFIG = {
  INPUT_COMPONENT: "input:2",          // Instance matérielle du compteur d'impulsions

  // --- Relais & Indicateurs Visuels ---
  YELLOW_RELAY_ID: 0,
  YELLOW_OFF_DURATION: 2000,           // Durée (ms) d'extinction de la LED jaune par litre

  BLUE_RELAY_ID: 1,
  BLUE_ON_DURATION: 5000,              // Durée (ms) d'allumage de la LED bleue (jalon)
  MILESTONE_STEP: 10,                  // Palier en Litres pour la LED bleue

  // --- Détection de Fuite / Fort Débit ---
  MAX_IDLE_GAP_SEC: 60,                // Écart max (sec) entre impulsions pour débit continu
  HIGH_FLOW_THRESHOLD_MIN: 5,          // Seuil de débit continu (min) déclenchant l'alerte
  TELEGRAM_REPEAT_MIN: 10,             // Fréquence (min) des rappels d'alerte fuite

  // --- Clé KVS Telegram ---
  ENABLE_TELEGRAM: 1,                  // 1 = Actif, 0 = Désactivé
  KVS_KEY_TELEGRAM: "telegram_config"  // Clé KVS contenant le JSON
};

// ============================================================================
// VARIABLES D'ÉTAT
// ============================================================================
let literCount = 0;                    // Index total du compteur
let hourlyConsumption = 0;             // Volume consommé dans l'heure en cours
let dailyConsumption = 0;              // Volume consommé dans la journée en cours

let lastReportedHour = -1;             // Suivi du changement d'heure
let lastReportedDay = -1;              // Suivi du changement de jour (minuit)

let yellowTimer = null;
let blueTimer = null;

let flowStartTime = 0;                 // Timestamp début de débit continu
let lastPulseTime = 0;                 // Timestamp dernière impulsion
let isFlowing = false;                 // Débit en cours ?
let highFlowAlertActive = false;       // Alerte fuite active ?
let lastTelegramAlertTime = 0;         // Timestamp dernière alerte fuite envoyée

// Initialisation des relais au démarrage
Shelly.call("Switch.Set", { id: CONFIG.YELLOW_RELAY_ID, on: true });  // Jaune : Allumé par défaut
Shelly.call("Switch.Set", { id: CONFIG.BLUE_RELAY_ID, on: false }); // Bleu  : Éteint par défaut

/**
 * Envoie un message Telegram vers le canal spécifié ("alert" ou "info")
 * 
 * Explication Shelly API :
 * 1. Shelly.call("KVS.Get") lit le JSON stocké en mémoire flash interne.
 * 2. JSON.parse() extrait bot_token, alert_chat_id et info_chat_id.
 * 3. Shelly.call("HTTP.Request") avec method: "POST" et Content-Type: "application/json"
 *    évite les erreurs d'encodage URL (ex: encodeURI absent en mJS).
 */
function sendTelegram(message, channelType) {
  if (CONFIG.ENABLE_TELEGRAM !== 1) return;

  Shelly.call("KVS.Get", { key: CONFIG.KVS_KEY_TELEGRAM }, function(res, err) {
    if (err !== 0 || !res || !res.value) {
      print("Erreur KVS : Impossible de lire la clé", CONFIG.KVS_KEY_TELEGRAM);
      return;
    }

    let config = JSON.parse(res.value);
    if (!config || !config.bot_token) {
      print("Erreur KVS : Format JSON invalide");
      return;
    }

    // Sélection du canal
    let chatId = (channelType === "alert") ? config.alert_chat_id : config.info_chat_id;
    if (!chatId) {
      print("Erreur : Chat ID non défini pour le canal", channelType);
      return;
    }

    let url = "https://api.telegram.org/bot" + config.bot_token + "/sendMessage";
    let payload = {
      chat_id: chatId,
      text: message
    };

    Shelly.call("HTTP.Request", {
      method: "POST",
      url: url,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }, function(httpRes, error_code, error_message) {
      if (error_code !== 0) {
        print("Erreur envoi Telegram (" + channelType + "):", error_message);
      } else {
        print("Message Telegram envoyé (" + channelType + ") avec succès.");
      }
    });
  });
}

/**
 * Clignotement inverse LED Jaune (Éteint 2s puis se rallume)
 */
function triggerYellowPulse() {
  if (yellowTimer !== null) Timer.clear(yellowTimer);

  Shelly.call("Switch.Set", { id: CONFIG.YELLOW_RELAY_ID, on: false });

  yellowTimer = Timer.set(CONFIG.YELLOW_OFF_DURATION, false, function() {
    Shelly.call("Switch.Set", { id: CONFIG.YELLOW_RELAY_ID, on: true });
    yellowTimer = null;
  });
}

/**
 * Allumage Jalon LED Bleue (Allumé 5s puis s'éteint)
 */
function triggerBlueMilestone() {
  if (blueTimer !== null) Timer.clear(blueTimer);

  Shelly.call("Switch.Set", { id: CONFIG.BLUE_RELAY_ID, on: true });

  blueTimer = Timer.set(CONFIG.BLUE_ON_DURATION, false, function() {
    Shelly.call("Switch.Set", { id: CONFIG.BLUE_RELAY_ID, on: false });
    blueTimer = null;
  });
}

/**
 * Analyse de débit continu pour la détection de fuite (Canal ALERT)
 */
function processFlowCheck(now) {
  // Arrosage/Puisage terminé si l'écart entre 2 impulsions dépasse MAX_IDLE_GAP_SEC
  if (isFlowing && (now - lastPulseTime > CONFIG.MAX_IDLE_GAP_SEC * 1000)) {
    print("Fin de puisage d'eau. Durée :", Math.floor((lastPulseTime - flowStartTime) / 1000), "s");
    isFlowing = false;
    flowStartTime = 0;
    highFlowAlertActive = false;
    lastTelegramAlertTime = 0;
    return;
  }

  // Débit continu en cours
  if (isFlowing) {
    let durationMin = (now - flowStartTime) / (60 * 1000);

    if (durationMin >= CONFIG.HIGH_FLOW_THRESHOLD_MIN) {
      let shouldAlert = false;

      if (!highFlowAlertActive) {
        highFlowAlertActive = true;
        shouldAlert = true;
      } else if (now - lastTelegramAlertTime >= CONFIG.TELEGRAM_REPEAT_MIN * 60 * 1000) {
        shouldAlert = true;
      }

      if (shouldAlert) {
        lastTelegramAlertTime = now;
        let alertMsg = "🚨 ALERTE FUITE / FORT DÉBIT !\n\n" +
                       "Consommation d'eau continue depuis " + Math.floor(durationMin) + " minutes.\n" +
                       "Index actuel : " + literCount + " L";
        sendTelegram(alertMsg, "alert");
      }
    }
  }
}

/**
 * ÉCOUTEUR DE STATUT (Status Handler) - Détection des impulsions
 * 
 * Pourquoi addStatusHandler au lieu d'addEventHandler ?
 * - addEventHandler écoute les événements discrets de type bouton.
 * - Le compteur input:2 met à jour l'objet `counts` dans l'état global du Shelly.
 * - addStatusHandler intercepte chaque mise à jour du composant "input:2" dès que `counts.total` varie.
 */
Shelly.addStatusHandler(function(status) {
  if (status.component === CONFIG.INPUT_COMPONENT) {
    if (typeof status.delta.counts !== "undefined" && typeof status.delta.counts.total === "number") {
      let newTotal = status.delta.counts.total;
      let diff = newTotal - literCount;

      // Traitement uniquement en cas de hausse réelle du compteur
      if (diff > 0) {
        let now = Date.now();
        literCount = newTotal;
        hourlyConsumption += diff;
        dailyConsumption += diff;

        print("Impulsion détectée sur input:2 ! Total :", literCount, "L (+", diff, "L)");

        // Début d'une nouvelle session de débit si arrêt préalable
        if (!isFlowing || (now - lastPulseTime > CONFIG.MAX_IDLE_GAP_SEC * 1000)) {
          isFlowing = true;
          flowStartTime = now;
          highFlowAlertActive = false;
          lastTelegramAlertTime = 0;
        }
        lastPulseTime = now;

        // Actionneurs visuels
        triggerYellowPulse();
        if (literCount % CONFIG.MILESTONE_STEP === 0) {
          triggerBlueMilestone();
        }

        processFlowCheck(now);
      }
    }
  }
});

/**
 * MONITORING TEMPOREL & RAPPORT HORAIRE (Canal INFO)
 * Timer récurrent exécuté toutes les 60 secondes.
 */
Timer.set(60000, true, function() {
  let now = Date.now();
  processFlowCheck(now);

  // Interrogation du composant Système pour obtenir l'heure et la date
  Shelly.call("Sys.GetStatus", {}, function(sysStatus, err) {
    if (err !== 0 || !sysStatus || !sysStatus.time) return;

    // sysStatus.time renvoie "HH:MM"
    let timeParts = sysStatus.time.split(":");
    let currentHour = Number(timeParts[0]);

    // Détection du changement d'heure
    if (lastReportedHour !== -1 && currentHour !== lastReportedHour) {
      
      // Envoi du rapport uniquement si consommation dans l'heure écoulée
      if (hourlyConsumption > 0) {
        let infoMsg = "📊 Rapport de consommation d'eau\n\n" +
                      "💧 Dernières 60 min : " + hourlyConsumption + " Litres\n" +
                      "📅 Cumul de la journée : " + dailyConsumption + " Litres\n" +
                      "🔢 Index compteur : " + literCount + " L";
        sendTelegram(infoMsg, "info");
      }

      // Remise à zéro du compteur horaire
      hourlyConsumption = 0;

      // Passage à minuit (00h) : Remise à zéro du cumul journalier
      if (currentHour === 0) {
        dailyConsumption = 0;
      }
    }
    lastReportedHour = currentHour;
  });
});

/**
 * INITIALISATION AU DÉMARRAGE DU SCRIPT
 * - Récupère les métadonnées matérielles (Device ID & Device Name).
 * - Récupère le statut complet (IP, heure, compteur matériel initial).
 * - Envoie une notification récapitulative sur le canal INFO.
 */
function bootInit() {
  // Récupération synchrone des infos du Shelly (ID et Nom personnalisé)
  let devInfo = Shelly.getDeviceInfo();
  let deviceId = devInfo.id || "Inconnu";
  let deviceName = devInfo.name ? devInfo.name : "Shelly Plus UNI";

  Shelly.call("Shelly.GetStatus", {}, function(res, err_code, err_msg) {
    if (err_code !== 0 || !res) {
      print("Erreur initialisation Shelly.GetStatus :", err_msg);
      return;
    }

    // Lecture du compteur initial sur input:2
    if (res["input:2"] && res["input:2"].counts && typeof res["input:2"].counts.total === "number") {
      literCount = res["input:2"].counts.total;
    }

    let ipAddress = (res.wifi && res.wifi.sta_ip) ? res.wifi.sta_ip : "Inconnue";
    let systemTime = (res.sys && res.sys.time) ? res.sys.time : "Inconnue";

    if (systemTime !== "Inconnue") {
      let timeParts = systemTime.split(":");
      lastReportedHour = Number(timeParts[0]);
    }

    print("Initialisation réussie pour", deviceName, "(ID :", deviceId + "). IP :", ipAddress, "| Index :", literCount);

    let bootMsg = "🚀 Démarrage du Script Compteur d'eau\n\n" +
                  "🏷️ Nom : " + deviceName + "\n" +
                  "🆔 ID : " + deviceId + "\n" +
                  "🌐 IP : " + ipAddress + "\n" +
                  "🕒 Heure : " + systemTime + "\n" +
                  "📊 Index initial (input:2) : " + literCount + " L";

    sendTelegram(bootMsg, "info");
  });
}

// Exécution du démarrage
bootInit();
