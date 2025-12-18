import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import router from './pages/data/DataFetch';

import middlewares from './middlewares';

dotenv.config();

const app = express();

app.use(morgan('dev'));
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use('/data', router);

app.get('/', (req, res) => {
  res.json({
    message: 'Express Works! Yeah!',
  });
});

app.use(middlewares.notFound);
app.use(middlewares.errorHandler);

export default app;
