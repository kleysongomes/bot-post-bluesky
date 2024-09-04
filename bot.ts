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

function createHashtagFacets(content: string) {
  const regex = /#\w+/g;
  const facets = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    const byteStart = Buffer.byteLength(content.slice(0, match.index));
    const byteEnd = byteStart + Buffer.byteLength(match[0]);

    facets.push({
      index: {
        byteStart: byteStart,
        byteEnd: byteEnd,
      },
      features: [
        {
          $type: "app.bsky.richtext.facet#link",
          uri: `https://bsky.app/search?q=${encodeURIComponent(match[0])}`,
        },
      ],
    });
  }

  return facets;
}

async function postToBluesky(content: string) {
  content += " #bolhadev";

  if (processedPosts.has(content)) {
    console.log(`Já postado: ${content}`);
    return;
  }

  console.log(`Postando: ${content}`);

  const { token, did } = await getAccessToken();

  const facets = createHashtagFacets(content);

  const postData = {
    $type: 'app.bsky.feed.post',
    repo: did,
    collection: 'app.bsky.feed.post',
    record: {
      text: content,
      facets: facets,
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

function showNextPostTime(interval: number) {
  const nextPostTime = new Date(Date.now() + interval).toLocaleTimeString();
  console.log(`Próxima postagem será às ${nextPostTime}`);
}

async function postFromJson(filePath: string) {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    const posts: Post[] = JSON.parse(data);
    const totalPosts = posts.length;

    for (let i = 0; i < totalPosts; i++) {
      console.log(`Post ${i + 1}/${totalPosts}`); // Exibe a quantidade de posts já realizados e os restantes
      await postToBluesky(posts[i].content);

      if (i < totalPosts - 1) {
        console.log(`Aguardando ${POST_INTERVAL / 1000 / 60} minutos antes da próxima postagem.`);
        showNextPostTime(POST_INTERVAL); // Mostra a hora da próxima postagem
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
