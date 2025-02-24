import { Router } from 'express';
import { asignar, desasignar } from '../controller/asignacionesController.js';
import { verifyParamaters } from '../src/funciones/verifyParameters.js';
import { getCompanyById } from '../db.js';

const asignaciones = Router();

asignaciones.post('/asignar', async (req, res) => {
    const errorMessage = verifyParamaters(req.body, ['dataQr', 'driverId']);

    if (errorMessage) {
        return res.status(400).json({ message: errorMessage });
    }

    const { companyId, userId, dataQr, driver } = req.body;

    if (companyId == 12 && userId == 49) {
        return res.status(200).json({ message: "Comunicarse con la logística." });
    }

    try {
        const company = await getCompanyById(companyId);

        const result = await asignar(company, userId, dataQr, driver);

        res.status(200).json({ body: result, message: "Asignación realizada correctamente" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

asignaciones.post('/desasignar', async (req, res) => {
    const errorMessage = verifyParamaters(req.body, ['dataQr', 'driverId']);

    if (errorMessage) {
        return res.status(400).json({ message: errorMessage });
    }

    const { companyId, userId, dataQr } = req.body;

    if (companyId == 12 && userId == 49) {
        return res.status(200).json({ message: "Comunicarse con la logística." });
    }

    try {
        const company = await getCompanyById(companyId);

        const result = await desasignar(company, dataQr);

        res.status(200).json({ body: result, message: "Asignación realizada correctamente" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


export default asignaciones;




