# Aida Voice Agent Frontend

This is the frontend application for the **Aida Voice Agent**, a real-time conversational AI system powered by the OpenAI Realtime API. The application is built with React, TypeScript, and Vite for fast and efficient development. 

---

## Prerequisites

1. **Node.js and npm**: Ensure you have the latest version installed from [nodejs.org](https://nodejs.org).
2. **Backend link**: A WebSocket server URL for communication. 
3. **Firebase account**: Set up a project for hosting the frontend.
4. **Recall.ai API Key**: Required to integrate with the bot creation endpoint.

---

## Local Development Environment

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/deltamod3/aida-voice-agent
   cd aida-voice-agent
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the project root with the following content:
   ```env
   VITE_WSS_SERVER_URL="wss://34.147.138.85"
   ```
   Replace the WebSocket server URL with your backend's URL.

4. **Start Development Server**:
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:4000`.

---

## Deploy to Firebase

1. **Install Firebase Tools**:
   ```bash
   npm install -g firebase-tools
   ```

2. **Initialize Firebase**:
   ```bash
   firebase login
   firebase init
   ```
   - Select **Hosting**.
   - Use an existing Firebase project or create a new one.
   - Set the `build` folder as the public directory.
   - Configure as a single-page app by answering `Yes` to the appropriate prompt.

3. **Build the Application**:
   ```bash
   npm run build
   ```

4. **Deploy to Firebase**:
   ```bash
   firebase deploy
   ```
   Your application will be live at the URL provided by Firebase.

---

## Testing

### Create a Bot Using Recall.ai
Use the following `curl` command to create a bot for integration with Google Meet:

```bash
curl --location 'https://eu-central-1.recall.ai/api/v1/bot/' \
--header 'Authorization: {{your_recall_api_key}}' \
--data '{
    "meeting_url": "{{your_google_meet_link}}",
    "bot_name": "Aida Voice Agent",
    "output_media": {
        "camera": {
            "kind": "webpage",
            "config": {
                "url": "{{your_agent_link}}"
            }
        }
    },
    "transcription_options": {
        "provider": "meeting_captions"
    },
    "recording_mode": "audio_only"
}'
```

Replace the placeholders:
- `{{your_recall_api_key}}`: Your Recall.ai API key.
- `{{your_google_meet_link}}`: A valid Google Meet link.
- `{{your_agent_link}}`: The public URL of the deployed frontend.
