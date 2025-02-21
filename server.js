import express from 'express';
import { json } from 'body-parser';
import asignaciones from './routes/asignaciones';

const app = express();
app.use(json({ limit: '50mb' }));
app.use(urlencoded({ limit: '50mb', extended: true }));
app.use(json());

const PORT = process.env.PORT || 3000;

app.use("/api/asignaciones", asignaciones)

app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
