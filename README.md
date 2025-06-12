# iAmTeacher

iAmTeacher (pronounced I am teacher) is an AI-powered English tutor app for students in rural areas, which most of them lack capable English teachers. This app will focus on vocal conversations, while also including written quizzes and other educational activities.

## How it works (conversation)
The vocal conversation parts will be working with OpenAI's Realtime API services. We'll give it a system prompt, and these will happen during the conversation:

1. Student starts the conversation
2. The frontend app will connect to the proxy via WebSocket and that will be passed through to OpenAI's transcriptions API.
3. What the student said will be transcribed and be an input to the LLM.
4. The output of the LLM will go into Text-to-Speech and played on the student's device.
5. Repeat 3-4 until conversation goals accomplished and finished

## Features we should have

- Multiple tuition/teaching styles to choose from
- The possibility of tailoring contents according to student's skill level and learning goals

## Setting up for local development

1. Get an OpenAI API key
2. Clone this repo
3. In App.jsx, change the websocket to `ws://localhost:3001`
4. Install dependencies with `npm install`
5. Clone the proxy repo to another folder
6. In the cloned proxy repo, create a `.env` with `OPENAI_API_KEY=sk-...` (put your API key here)
7. In the cloned proxy repo, install dependencies with `npm install`
8. In the cloned proxy repo, run the server with `node server.js`


## License

- iAmTeacher Frontend/app is licensed under GPLv3 license. For the backend/server-side part, please see [iAmTeacher Proxy](https://github.com/OpenTech-Thailand/iamteacher-proxy).

## Special Thanks

This project is made possible by

<img src="assets/ots.png" alt="opentech" height="50"/>
<img src="assets/zymple.png" alt="Zymple" height="50"/>
<img src="assets/ttt-org.svg" alt="ttt-org" height="50"/>
