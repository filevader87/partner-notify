const { createApp } = require('./app');
const { validateProductionConfig } = require('./config');

const port = Number.parseInt(process.env.PORT || '3000', 10);
validateProductionConfig(process.env);
const app = createApp();

app.listen(port, () => {
  console.log(`Let Them Know API listening on port ${port}`);
});
