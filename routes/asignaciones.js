import { Router } from 'express';
const asignaciones = Router();

asignaciones.post('/api/asignar', async (req, res) => {
    const errorMessage = verifyParamaters(req.body, ['dataQr', 'driver']);

    if (errorMessage) {
        return res.status(400).json({ message: errorMessage });
    }

    const { companyId, userId, dataQr, driver } = req.body;

    if (companyId == 12 && userId == 49) {
        return res.status(200).json({ message: "Comunicarse con la logística." });
    }

    try {

        const result = await asignar();

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

    const { companyId, userId, dataQr } = req.body;

    if (companyId == 12 && userId == 49) {
        return res.status(200).json({ message: "Comunicarse con la logística." });
    }

    try {
        const result = await desasignar();

        res.status(200).json({ body: result, message: "Asignación realizada correctamente" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


export default asignaciones;




