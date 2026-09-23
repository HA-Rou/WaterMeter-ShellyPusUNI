# Shelly Plus UNI - Smart Water Meter & Leak Detection

*Version Française ci-dessous / French version below.*

## 🇬🇧 English Version

### What is the Shelly Plus Uni?
The **Shelly Plus Uni** is a small, smart Wi-Fi module designed for low-voltage applications. It is incredibly versatile, allowing you to make "dumb" appliances smart by reading data from various sensors (temperature, humidity, pulse counters, ADCs) and controlling low-voltage devices via its two solid-state relays. Because it operates on low voltage (12-24V AC or 9-28V DC), it is perfect for safe DIY home automation projects like reading a water meter.

### What does this script do?
This script (`waterMeter.js`) transforms your Shelly Plus Uni into a comprehensive smart water monitoring system using a pulse water meter. Its core features include:
- **Pulse Counting:** It reads pulses from `input:2` (each pulse typically represents 1 liter, depending on your water meter).
- **Visual Indicators:**
  - **Yellow LED (Relay 0):** Normally ON, it briefly turns OFF for 2 seconds every time 1 liter is consumed.
  - **Blue LED (Relay 1):** Normally OFF, it turns ON for 5 seconds every 10 liters (milestone indicator).
- **Leak & High-Flow Detection:** If water flows continuously for more than 5 minutes (without a 60-second gap), it triggers a Telegram alert to warn you of a potential leak or an accidentally left-open tap. Reminders are sent every 10 minutes if the flow continues.
- **Hourly & Daily Reporting:** Every hour, it sends a Telegram message detailing the consumption of the past 60 minutes, the daily cumulative total, and the current meter index.
- **Boot Notification:** Sends a system summary via Telegram whenever the script or device restarts.

### Configuration & Installation

#### 1. Hardware Setup
- Connect your pulse water meter to **Input 2** of the Shelly Plus Uni.
- *(Optional)* Connect a Yellow indicator LED to **Out 1 (Relay 0)** and a Blue indicator LED to **Out 2 (Relay 1)**.

#### 2. Shelly Web Interface Configuration
- Access your Shelly's local IP address in a web browser.
- Go to the configuration for **Input 2**. Set its type to **Pulse Counter** (or ensure it is configured to accurately report `counts.total` via status deltas).

#### 3. Telegram Bot Setup
- Open Telegram, search for **@BotFather**, and create a new bot using `/newbot`.
- Save the provided **Bot Token**.
- Send a message to your new bot.
- Visit `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates` in your browser to find your **Chat ID**. You can use the same Chat ID for both alerts and info, or create dedicated Telegram groups and use their respective Chat IDs.

#### 4. KVS (Key-Value Store) Configuration
The script securely reads your Telegram credentials from the Shelly's internal storage (KVS) to avoid hardcoding secrets in the script.
- In the Shelly Web UI, navigate to **Advanced** -> **KVS**.
- Create a new key named exactly: `telegram_config`
- Set its value to a valid JSON string containing your credentials:
  ```json
  {
    "bot_token": "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ",
    "alert_chat_id": "987654321",
    "info_chat_id": "987654321"
  }
  ```
- or configure the KVS using this HTTP request :
  ```plaintext
  http://<IP_SHELLY>/rpc/KVS.Set?key="telegram_config"&value="{\"bot_token\":\"VOTRE_TOKEN_BOT\",\"alert_chat_id\":\"VOTRE_CHAT_ID_ALERTE\",\"info_chat_id\":\"VOTRE_CHAT_ID_INFO\"}"
  ```
  *(Replace the placeholder values with your actual Token and Chat IDs).*

#### 5. Script Installation
- In the Shelly Web UI, go to **Scripts**.
- Create a new script, paste the entire content of `waterMeter.js` into it, and save.
- Turn on the **"Enable on boot"** toggle.
- Click **Start** to run the script. You should receive a startup message on Telegram!

---
---

## 🇫🇷 Version Française

### Qu'est-ce que le Shelly Plus Uni ?
Le **Shelly Plus Uni** est un petit module Wi-Fi intelligent conçu pour les applications basse tension. Il est extrêmement polyvalent et permet de "connecter" des appareils classiques en lisant les données de divers capteurs (température, humidité, compteurs d'impulsions, analogiques) et en contrôlant des appareils basse tension via ses deux relais statiques. Fonctionnant en basse tension (12-24V AC ou 9-28V DC), il est idéal et sécurisé pour les projets domotiques DIY, comme la lecture d'un compteur d'eau.

### Que fait ce script ?
Ce script (`waterMeter.js`) transforme votre Shelly Plus Uni en un système complet de surveillance de l'eau en utilisant un compteur d'eau à impulsions. Ses principales fonctionnalités sont :
- **Comptage d'impulsions :** Il lit les impulsions sur l'`input:2` (généralement 1 impulsion = 1 litre, selon votre compteur).
- **Indicateurs Visuels :**
  - **LED Jaune (Relais 0) :** Normalement allumée, elle s'éteint brièvement pendant 2 secondes à chaque litre consommé.
  - **LED Bleue (Relais 1) :** Normalement éteinte, elle s'allume pendant 5 secondes tous les 10 litres (indicateur de palier).
- **Détection de Fuite & Fort Débit :** Si l'eau coule en continu pendant plus de 5 minutes (sans interruption de 60 secondes), une alerte Telegram est déclenchée pour vous prévenir d'une fuite potentielle ou d'un robinet oublié. Des rappels sont envoyés toutes les 10 minutes.
- **Rapports Horaires & Journaliers :** Chaque heure, un message Telegram est envoyé, détaillant la consommation des 60 dernières minutes, le cumul journalier et l'index actuel du compteur.
- **Notification de Démarrage :** Envoie un résumé du système via Telegram à chaque redémarrage de l'appareil ou du script.

### Configuration & Installation

#### 1. Câblage Matériel
- Connectez votre compteur d'eau à impulsion sur l'**Input 2** du Shelly Plus Uni.
- *(Optionnel)* Connectez une LED jaune sur **Out 1 (Relais 0)** et une LED bleue sur **Out 2 (Relais 1)**.

#### 2. Configuration de l'Interface Web Shelly
- Accédez à l'adresse IP locale de votre Shelly via un navigateur web.
- Allez dans la configuration de l'**Input 2**. Réglez son type sur **Pulse Counter** (Compteur d'impulsions) pour vous assurer qu'il remonte bien les données `counts.total`.

#### 3. Configuration du Bot Telegram
- Ouvrez Telegram, cherchez **@BotFather**, et créez un nouveau bot avec la commande `/newbot`.
- Sauvegardez le **Bot Token** qui vous est fourni.
- Envoyez un premier message à votre nouveau bot.
- Visitez `https://api.telegram.org/bot<VOTRE_BOT_TOKEN>/getUpdates` dans votre navigateur pour trouver votre **Chat ID**. Vous pouvez utiliser le même Chat ID pour les alertes et les infos, ou créer des groupes distincts.

#### 4. Configuration du KVS (Stockage Clé-Valeur)
Le script lit vos identifiants Telegram de manière sécurisée dans la mémoire interne du Shelly (KVS) pour éviter de les écrire en clair dans le code.
- Dans l'interface web Shelly, allez dans **Advanced** -> **KVS**.
- Créez une nouvelle clé nommée exactement : `telegram_config`
- Définissez sa valeur avec une chaîne JSON valide contenant vos informations :
  ```json
  {
    "bot_token": "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ",
    "alert_chat_id": "987654321",
    "info_chat_id": "987654321"
  }
  ```
- ou via cette requête HTTP :
  ```plaintext
  http://<IP_SHELLY>/rpc/KVS.Set?key="telegram_config"&value="{\"bot_token\":\"VOTRE_TOKEN_BOT\",\"alert_chat_id\":\"VOTRE_CHAT_ID_ALERTE\",\"info_chat_id\":\"VOTRE_CHAT_ID_INFO\"}"
  ```
  
  *(Remplacez les valeurs d'exemple par votre propre Token et vos Chat IDs).*

#### 5. Installation du Script
- Dans l'interface web Shelly, allez dans **Scripts**.
- Créez un nouveau script, collez l'intégralité du contenu de `waterMeter.js` à l'intérieur, puis sauvegardez.
- Activez l'option **"Enable on boot"** (Activer au démarrage).
- Cliquez sur **Start** pour lancer le script. Vous devriez immédiatement recevoir un message de démarrage sur Telegram !
