# iAmTeacher

iAmTeacher (pronounced I am teacher) is an AI-powered English tutor app for students in rural areas, which most of them lack capable English teachers. This app will focus on vocal conversations, while also including written quizzes and other educational activities.

## How it works (conversation)
The vocal conversation parts will be working with OpenAI's Realtime API services. We'll give it a system prompt, and these will happen during the conversation:

1. Student starts the conversation
2. The frontend app will connect to the proxy via WebRTC and that will be passed through to OpenAI's transcriptions API.
3. What the student said will be transcribed and be an input to the LLM.
4. The output of the LLM will go into Text-to-Speech and played on the student's device.
5. Repeat 3-4 until conversation goals accomplished and finished

## Features we should have

- Multiple tuition/teaching styles to choose from
- The possibility of tailoring contents according to student's skill level and learning goals

## Setting up for local development

Before you begin, you'll need an OpenAI API key - [create one in the dashboard here](https://platform.openai.com/settings/api-keys). Create a `.env` file from the example file and set your API key in there:

```bash
cp .env.example .env
```

Running this application locally requires [Node.js](https://nodejs.org/) to be installed. Install dependencies for the application with:

```bash
npm install
```

Start the application server with:

```bash
npm run dev
```

This should start the console application on [http://localhost:3000](http://localhost:3000).


## License

- iAmTeacher Frontend/app is dual-licensed under the AGPLv3 license and a bespoke license granted exclusively to Zymple. While the general public may use, modify, and distribute the software under the terms of the AGPLv3, Zymple is additionally permitted to use, modify, and distribute the software under the terms of a separate, bespoke license at Zymple's discretion.

Zymple is a business unit of Manima BKK Co., Ltd.

## Special Thanks

This project is made possible by

<img src="assets/ots.png" alt="opentech" height="50"/>
<img src="assets/zymple.png" alt="Zymple" height="50"/>
<img src="assets/ttt-org.svg" alt="ttt-org" height="50"/>
