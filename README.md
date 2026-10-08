# aircnc-backend

API REST do AirCnC em Node.js. Projeto de estudo de backend iniciado no SENAC, usado aqui
para praticar o que importa em teste de API: contrato de rota, status code, formato de
resposta e comportamento quando a chamada falha.

Estado atual: a base do servidor esta pronta e funcionando (HTTP, CORS, Socket.IO, arquivos
estaticos, 404 e handler de erro em JSON). As rotas de dominio do AirCnC (sessao, spots,
bookings) ainda nao existem no codigo. A tabela abaixo lista so o que de fato responde hoje.

## Stack

- Express 5 para as rotas HTTP
- Mongoose 8 para a conexao com o MongoDB
- Socket.IO 4 para a conexao em tempo real
- dotenv para configuracao, cors para acesso entre origens
- nodemon em desenvolvimento

## Rodando

```bash
npm install
cp .env.example .env     # preencha MONGO_URI
npm run dev              # ou npm start
```

O servidor sobe em `http://localhost:3333`. Sem `MONGO_URI` definida ele nao sobe: imprime
`MONGO_URI nao definida` e sai com codigo 1, de proposito, para nao ficar de pe sem banco.

## Rotas

| Metodo | Caminho | Recebe | Devolve |
|---|---|---|---|
| GET | `/` | nada | `200` `application/json` com `{ "name": "aircnc-backend", "status": "ok" }` |
| GET | `/ping` | nada | `200` `text/html` com o texto `pong` |
| GET | `/files/<arquivo>` | nome do arquivo no caminho | `200` com o arquivo de `uploads/`, ou `404` JSON se nao existir |
| qualquer | caminho nao mapeado | nada | `404` `application/json` com `{ "error": "rota nao encontrada" }` |

Erro nao tratado em qualquer rota cai no handler de erro: `500` `application/json` com
`{ "error": "erro interno no servidor" }`. O erro real vai para o log do servidor, nao para
a resposta.

Verificado subindo o app numa porta efemera e chamando as quatro linhas da tabela.

## Socket.IO

O cliente conecta passando o id do usuario na query da conexao:

```js
const socket = io('http://localhost:3333', { query: { user_id: '<id>' } });
```

O servidor guarda os `socket.id` por `user_id` em memoria e remove no `disconnect`.
Conexao sem `user_id` e aceita, mas nao entra nesse mapa. O objeto fica disponivel nas
rotas como `req.connectedUsers`, e a instancia do io como `req.io`, para quando as rotas
de booking precisarem notificar o dono do spot.

Como o mapa vive na memoria do processo, ele nao sobrevive a um restart e nao funciona com
mais de uma instancia. Para producao isso precisaria de um adapter (Redis, por exemplo).

## Variaveis de ambiente

| Variavel | Para que serve | Obrigatoria |
|---|---|---|
| `MONGO_URI` | string de conexao do MongoDB | sim |
| `PORT` | porta do servidor HTTP, padrao `3333` | nao |
| `CLIENT_URL` | origem liberada no CORS e no Socket.IO, padrao `http://localhost:5173` | nao |

## O que falta

- Rotas de sessao, spots e bookings, com os models do Mongoose.
- Upload de imagem do spot: o `multer` esta instalado e `/files` ja serve a pasta
  `uploads/`, mas a rota de upload ainda nao foi escrita.
- Suite de teste automatizado das rotas.
