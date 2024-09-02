import axios from 'axios';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

const API_URL = 'https://bsky.social/xrpc';
const POST_INTERVAL = 3600000; // 1 hora em milissegundos

const processedPosts = new Set<string>();

interface Post {
  content: string;
}

async function getAccessToken() {
  const { data } = await axios.post(`${API_URL}/com.atproto.server.createSession`, {
    identifier: process.env.IDENTIFIER,
    password: process.env.PASSWORD,
  });

  return { token: data.accessJwt, did: data.did };
}

async function postToBluesky(content: string, token: string, did: string) {
  if (processedPosts.has(content)) {
    console.log(`Já postado: ${content}`);
    return;
  }

  console.log(`Postando: ${content}`);

  const postData = {
    $type: 'app.bsky.feed.post',
    repo: did,
    collection: 'app.bsky.feed.post',
    record: {
      text: content,
      createdAt: new Date().toISOString(),
    },
  };

  const { data } = await axios.post(`${API_URL}/com.atproto.repo.createRecord`, postData, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  processedPosts.add(content);

  console.log(`Postagem realizada com sucesso: ${data}`);
}

function startCountdown(interval: number) {
  let timeLeft = interval / 1000; // Converter milissegundos para segundos

  const timer = setInterval(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    console.log(`Próxima postagem em: ${minutes} minutos e ${seconds} segundos`);
    timeLeft--;

    if (timeLeft < 0) {
      clearInterval(timer);
    }
  }, 1000);
}

async function postFromJson(filePath: string) {
  try {
    const { token, did } = await getAccessToken();

    const data = fs.readFileSync(filePath, 'utf-8');
    const posts: Post[] = JSON.parse(data);

    for (let i = 0; i < posts.length; i++) {
      await postToBluesky(posts[i].content, token, did);
      
      if (i < posts.length - 1) {
        console.log(`Aguardando ${POST_INTERVAL / 1000 / 60} minutos antes da próxima postagem.`);
        startCountdown(POST_INTERVAL); // Iniciar a contagem regressiva
        await new Promise((resolve) => setTimeout(resolve, POST_INTERVAL));
      } else {
        console.log('Todas as postagens foram concluídas. Encerrando o bot...');
        process.exit(0); // Encerra o bot após todas as postagens serem concluídas
      }
    }
  } catch (error) {
    console.error('Erro:', error);
    process.exit(1);
  }
}

postFromJson('posts.json');
