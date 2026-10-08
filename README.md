# aircnc-backend

API REST do AirCnC em Node.js, feita para praticar backend: rotas, persistencia,
upload de arquivo e comunicacao em tempo real.

## Stack

- **Express** para as rotas HTTP
- **MongoDB** com Mongoose para os dados
- **Multer** para upload de imagem
- **Socket.IO** para notificacao em tempo real
- **dotenv** e **cors** para configuracao e acesso entre origens

## Rodando

```bash
npm install
cp .env.example .env    # ajuste a string de conexao do MongoDB
npm start
```

A API sobe em `http://localhost:3333`.
