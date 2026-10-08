# aircnc-backend

API REST do AirCnC em Node.js. Projeto de estudo de backend iniciado no SENAC, usado aqui
para praticar o que importa em teste de API: contrato de rota, status code, formato de
resposta e comportamento quando a chamada falha.

A ideia do AirCnC: empresas cadastram spots (espacos de trabalho com foto, techs e preco),
desenvolvedores entram com o email, procuram spots por tech e pedem reserva para um dia.
O dono do spot recebe o pedido em tempo real pelo Socket.IO e aprova ou rejeita.

## Stack

- Express 5 para as rotas HTTP (as rejeicoes de handler async ja caem no handler de erro, sem wrapper)
- Mongoose 8 para o MongoDB
- Multer 2 para o upload da foto do spot
- Socket.IO 4 para avisar dono e hospede em tempo real
- helmet, cors e express-rate-limit na borda
- dotenv para configuracao
- jest e supertest nos testes, nodemon em desenvolvimento

## Estrutura

```
src/
  server.js          sobe o http, conecta no mongo e trata o encerramento
  app.js             monta o express (helmet, cors, rate limit, json, rotas, 404, erros)
  routes.js          mapa das rotas e quais middlewares cada uma usa
  config/env.js      le e valida as variaveis de ambiente
  controllers/       sessions, spots, dashboard, bookings
  validators/        validacao de entrada de cada rota
  models/            User, Spot, Booking (mongoose)
  middlewares/       require-user, require-database, request-logger, not-found, error-handler
  lib/               errors, logger, upload, presenters, realtime (socket.io), database
tests/               jest + supertest, models mockados, sem banco
```

Fluxo de uma requisicao: `app.js` aplica os middlewares globais, `routes.js` escolhe
controller e middlewares da rota, o validator checa a entrada e lanca `AppError` se algo
estiver errado, o controller fala com os models e devolve o JSON montado pelos presenters.
Qualquer erro (lancado ou rejeitado) termina no `error-handler`, que escolhe o status e o
corpo da resposta.

## Rodando

```bash
npm install
cp .env.example .env     # preencha MONGO_URI
npm run dev              # nodemon, ou npm start
```

O servidor sobe em `http://localhost:3333`. A partida valida todas as variaveis de ambiente
de uma vez: se alguma estiver errada ele imprime a lista de problemas e sai com codigo 1.

O http sobe antes da conexao com o banco. `/`, `/ping`, `/health` e `/files` respondem
sempre; as rotas de dominio respondem `503 { "error": "banco de dados indisponivel" }` ate o
Mongo conectar. Se a conexao falhar, o servidor tenta de novo a cada `DB_RETRY_MS` e loga cada
tentativa. `SIGINT` e `SIGTERM` fecham sockets, http e banco antes de sair.

## Testes

```bash
npm test
```

Os testes rodam sem MongoDB: os models sao mockados com `jest.mock`, e o `createApp` recebe
versoes falsas do socket e da conexao. Cobrem cada rota em sucesso e erro (validacao, 401,
403, 404, 409, 413, 415, 429, 500 em dev e em producao), os validators, a leitura das
variaveis de ambiente, o upload (tipo, tamanho e assinatura do arquivo), as salas do
Socket.IO com um cliente real e a partida do processo com um `MONGO_URI` que nao responde.

## Variaveis de ambiente

| Variavel | Para que serve | Padrao |
|---|---|---|
| `MONGO_URI` | string de conexao do MongoDB (`mongodb://` ou `mongodb+srv://`) | obrigatoria |
| `NODE_ENV` | `development`, `production` ou `test`; em `production` o 500 nao traz mensagem nem stack | `development` |
| `PORT` | porta do http (`0` escolhe uma livre) | `3333` |
| `APP_URL` | url publica da api, base do `thumbnail_url` | `http://localhost:PORT` |
| `CLIENT_URL` | origens liberadas no CORS e no Socket.IO, separadas por virgula, ou `*` | `http://localhost:5173` |
| `TRUST_PROXY` | `true` atras de proxy reverso, para o rate limit ver o ip real | `false` |
| `UPLOAD_DIR` | pasta das imagens, relativa a raiz do projeto ou absoluta | `uploads` |
| `UPLOAD_MAX_MB` | tamanho maximo da imagem | `2` |
| `UPLOAD_MIME_TYPES` | tipos aceitos (`image/jpeg`, `image/png`, `image/webp`, `image/gif`) | `image/jpeg,image/png,image/webp` |
| `RATE_LIMIT_WINDOW_MS` | janela do rate limit por ip | `900000` (15 min) |
| `RATE_LIMIT_MAX` | requisicoes por ip na janela (`/files` nao conta) | `300` |
| `DB_CONNECT_TIMEOUT_MS` | tempo maximo de cada tentativa de conexao | `5000` |
| `DB_RETRY_MS` | intervalo entre tentativas | `10000` |
| `LOG_LEVEL` | `debug`, `info`, `warn`, `error` ou `silent` | `info` (`silent` em test) |

## Formato das respostas de erro

Todo erro volta como JSON com `error` e, quando ha mais de um motivo, `details`:

```json
{ "error": "dados invalidos", "details": ["company e obrigatoria", "techs e obrigatoria (lista separada por virgula)"] }
```

| Status | Quando |
|---|---|
| `400` | entrada invalida, id fora do formato, JSON malformado, regra de negocio simples |
| `401` | header `user_id` ausente, fora do formato ou de usuario inexistente |
| `403` | tentou responder reserva de um spot que nao e seu |
| `404` | rota, spot ou reserva nao encontrada |
| `409` | reserva repetida, reserva ja respondida, registro duplicado |
| `413` | imagem acima de `UPLOAD_MAX_MB` ou JSON acima de 100kb |
| `415` | tipo de arquivo fora de `UPLOAD_MIME_TYPES` ou conteudo que nao e a imagem anunciada |
| `429` | passou de `RATE_LIMIT_MAX` requisicoes na janela |
| `500` | erro inesperado; fora de producao a resposta inclui `details` e `stack` |
| `503` | banco de dados indisponivel |

## Identificacao

Como no projeto original nao ha senha nem token: `POST /sessions` com o email devolve o
usuario, e as rotas que precisam saber quem chama recebem o `_id` dele no header `user_id`.
Isso serve para o estudo, nao para producao.

## Rotas

| Metodo | Caminho | Header `user_id` | Devolve |
|---|---|---|---|
| GET | `/` | nao | `{ "name": "aircnc-backend", "status": "ok" }` |
| GET | `/ping` | nao | texto `pong` |
| GET | `/health` | nao | estado do banco |
| POST | `/sessions` | nao | usuario (200 existente, 201 criado) |
| GET | `/spots?tech=` | nao | lista de spots |
| POST | `/spots` | sim | spot criado (multipart) |
| GET | `/dashboard` | sim | spots do usuario |
| POST | `/spots/:spot_id/bookings` | sim | reserva criada |
| POST | `/bookings/:booking_id/approvals` | sim (dono do spot) | reserva aprovada |
| POST | `/bookings/:booking_id/rejections` | sim (dono do spot) | reserva rejeitada |
| GET | `/files/:arquivo` | nao | imagem enviada |

Nos exemplos abaixo `$API` e `http://localhost:3333`.

### GET /health

```bash
curl $API/health
```

```json
{ "status": "ok", "database": "connected", "uptime": 42 }
```

Com o banco fora: `status` vira `degraded` e `database` vira `disconnected`, ainda com 200.

### POST /sessions

Entra com o email; cria o usuario se nao existir. O email e normalizado (minusculas, sem
espacos nas pontas).

```bash
curl -X POST $API/sessions -H 'content-type: application/json' -d '{"email":"dev@exemplo.com"}'
```

`200` (ja existia) ou `201` (criado):

```json
{ "_id": "66f1c0a2b7e9d3a1c4f0e111", "email": "dev@exemplo.com" }
```

`400` sem email ou com email invalido:

```json
{ "error": "dados invalidos", "details": ["email invalido"] }
```

### GET /spots

Lista todos os spots, mais recentes primeiro. `tech` filtra por igualdade ignorando
maiusculas (`react` encontra `React`, nao `ReactJS`).

```bash
curl "$API/spots?tech=React"
```

```json
[
  {
    "_id": "66f1c0a2b7e9d3a1c4f0e222",
    "thumbnail": "3f9a1c2e4b5d6a7f8c9d0e1f2a3b4c5d.png",
    "thumbnail_url": "http://localhost:3333/files/3f9a1c2e4b5d6a7f8c9d0e1f2a3b4c5d.png",
    "company": "ACME",
    "price": 120,
    "techs": ["React", "Node"],
    "user": "66f1c0a2b7e9d3a1c4f0e111",
    "createdAt": "2026-10-08T22:00:00.000Z"
  }
]
```

`price` vem `null` quando o spot e gratuito.

### POST /spots

Multipart com a foto no campo `thumbnail` e os campos `company`, `techs` (lista separada
por virgula) e `price` (opcional; vazio e gratuito). Exige o header `user_id`.

```bash
curl -X POST $API/spots \
  -H 'user_id: 66f1c0a2b7e9d3a1c4f0e111' \
  -F 'thumbnail=@foto.png' \
  -F 'company=ACME' \
  -F 'techs=React, Node' \
  -F 'price=120'
```

`201`:

```json
{
  "_id": "66f1c0a2b7e9d3a1c4f0e222",
  "thumbnail": "3f9a1c2e4b5d6a7f8c9d0e1f2a3b4c5d.png",
  "thumbnail_url": "http://localhost:3333/files/3f9a1c2e4b5d6a7f8c9d0e1f2a3b4c5d.png",
  "company": "ACME",
  "price": 120,
  "techs": ["React", "Node"],
  "user": "66f1c0a2b7e9d3a1c4f0e111",
  "createdAt": "2026-10-08T22:00:00.000Z"
}
```

A imagem e gravada com nome aleatorio e extensao do tipo detectado pelos primeiros bytes
do arquivo, nao pelo nome enviado. Erros: `400` com a lista de campos (a imagem nao e
gravada), `401` sem `user_id`, `413` acima do limite, `415` tipo nao aceito ou conteudo que
nao e imagem.

### GET /dashboard

Spots do usuario do header, mais recentes primeiro. Mesmo formato de `GET /spots`.

```bash
curl $API/dashboard -H 'user_id: 66f1c0a2b7e9d3a1c4f0e111'
```

`401` sem header, com header fora do formato ou de usuario inexistente:

```json
{ "error": "informe o header user_id" }
```

### POST /spots/:spot_id/bookings

Pede reserva de um spot para um dia (`YYYY-MM-DD`, hoje ou futuro). Nao da para reservar o
proprio spot nem repetir o pedido para o mesmo dia.

```bash
curl -X POST $API/spots/66f1c0a2b7e9d3a1c4f0e222/bookings \
  -H 'user_id: 66f1c0a2b7e9d3a1c4f0e333' \
  -H 'content-type: application/json' \
  -d '{"date":"2026-11-20"}'
```

`201`, com `approved: null` enquanto o dono nao responde:

```json
{
  "_id": "66f1c0a2b7e9d3a1c4f0e444",
  "date": "2026-11-20",
  "approved": null,
  "user": { "_id": "66f1c0a2b7e9d3a1c4f0e333", "email": "dev@exemplo.com" },
  "spot": {
    "_id": "66f1c0a2b7e9d3a1c4f0e222",
    "thumbnail": "3f9a1c2e4b5d6a7f8c9d0e1f2a3b4c5d.png",
    "thumbnail_url": "http://localhost:3333/files/3f9a1c2e4b5d6a7f8c9d0e1f2a3b4c5d.png",
    "company": "ACME",
    "price": 120,
    "techs": ["React", "Node"],
    "user": "66f1c0a2b7e9d3a1c4f0e111",
    "createdAt": "2026-10-08T22:00:00.000Z"
  },
  "createdAt": "2026-10-09T10:00:00.000Z"
}
```

Erros: `400` (`spot_id` fora do formato, data faltando, formato errado, dia inexistente,
data passada, spot proprio), `404` spot nao encontrado, `409` reserva repetida.

Se o dono do spot estiver conectado no socket, recebe o evento `booking_request` com esse
mesmo JSON.

### POST /bookings/:booking_id/approvals e /rejections

So o dono do spot responde, uma vez. Nao tem corpo.

```bash
curl -X POST $API/bookings/66f1c0a2b7e9d3a1c4f0e444/approvals -H 'user_id: 66f1c0a2b7e9d3a1c4f0e111'
curl -X POST $API/bookings/66f1c0a2b7e9d3a1c4f0e444/rejections -H 'user_id: 66f1c0a2b7e9d3a1c4f0e111'
```

`200` com a reserva no mesmo formato acima e `approved` `true` ou `false`. Quem pediu
recebe o evento `booking_response` com esse JSON se estiver conectado.

Erros: `400` `booking_id` fora do formato, `403` quem chama nao e dono do spot, `404` reserva
nao encontrada, `409` reserva ja respondida.

### GET /files/:arquivo

Serve a imagem de `UPLOAD_DIR` com `Cross-Origin-Resource-Policy: cross-origin`, para o
front em outra origem conseguir carregar. Arquivo inexistente devolve o `404` em JSON.

## Socket.IO

O cliente conecta passando o id do usuario na query:

```js
const socket = io('http://localhost:3333', { query: { user_id: '66f1c0a2b7e9d3a1c4f0e111' } });
socket.on('booking_request', booking => { /* dono do spot: alguem pediu reserva */ });
socket.on('booking_response', booking => { /* hospede: o dono respondeu */ });
```

Cada socket entra na sala `user:<user_id>`; conexao sem `user_id` valido e aceita mas nao
entra em sala nenhuma. O CORS do socket usa as mesmas origens de `CLIENT_URL`.

As salas vivem na memoria do processo: nao sobrevivem a restart e nao funcionam com mais de
uma instancia. Para isso seria preciso um adapter (Redis, por exemplo).

## Seguranca

- `helmet` com os cabecalhos padrao; `Cross-Origin-Resource-Policy` liberado para `/files`.
- CORS restrito as origens de `CLIENT_URL`; outras origens nao recebem `Access-Control-Allow-Origin`.
- Rate limit por ip (`RATE_LIMIT_*`), com cabecalhos `RateLimit` e resposta `429` em JSON.
- JSON limitado a 100kb; upload limitado por tamanho, quantidade (1 arquivo) e tipo, com o
  conteudo conferido pela assinatura do arquivo antes de gravar.
- Em `production` o 500 nao expoe mensagem nem stack; o erro vai para o log.
- `user_id` como header nao e autenticacao: qualquer um que saiba um id age por aquele usuario.

## O que falta

- Autenticacao de verdade (senha ou token) no lugar do header `user_id`.
- Listar e cancelar as reservas de um usuario.
- Adapter do Socket.IO para rodar mais de uma instancia.
