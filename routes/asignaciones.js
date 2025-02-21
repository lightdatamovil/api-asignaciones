import { Router } from 'express';
const asignaciones = Router();

asignaciones.post('/api/asignar', async (req, res) => {
    const errorMessage = verifyParamaters(req.body, ['dataQr', 'driver']);

    if (errorMessage) {
        return res.status(400).json({ message: errorMessage });
    }

    try {
        const { companyId, dataQr, driver } = req.body;

        const result = await handleOperador(dataEntrada, res);

        res.status(200).json({ body: result, message: "Asignación realizada correctamente" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }

});

asignaciones.post('/api/desasignar', async (req, res) => {
    const errorMessage = verifyParamaters(req.body, ['dataQr', 'driver']);

    if (errorMessage) {
        return res.status(400).json({ message: errorMessage });
    }

    try {
        const { companyId, dataQr, driver } = req.body;

        const result = await handleOperador(dataEntrada, res);

        res.status(200).json({ body: result, message: "Asignación realizada correctamente" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


export default asignaciones;




