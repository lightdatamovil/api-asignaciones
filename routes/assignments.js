import { Router } from 'express';
import { asignar, desasignar } from '../controller/assignmentsController.js';
import { verifyParamaters } from '../src/functions/verifyParameters.js';
import { getCompanyById } from '../db.js';

const asignaciones = Router();

asignaciones.post('/asignar', async (req, res) => {
    console.log(req.body);
    const errorMessage = verifyParamaters(req.body, ['dataQr', 'driverId', 'deviceFrom']);

    if (errorMessage) {
        return res.status(400).json({ message: errorMessage });
    }

    const { companyId, userId, dataQr, driverId, deviceFrom } = req.body;

    if (companyId == 12 && userId == 49) {
        return res.status(200).json({ message: "Comunicarse con la logística." });
    }

    try {
        const company = await getCompanyById(companyId);

        const result = await asignar(company, userId, JSON.parse(dataQr), driverId, deviceFrom);

        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

asignaciones.post('/desasignar', async (req, res) => {
    const errorMessage = verifyParamaters(req.body, ['dataQr', 'deviceFrom']);

    if (errorMessage) {
        return res.status(400).json({ message: errorMessage });
    }

    const { companyId, userId, dataQr, deviceFrom } = req.body;

    if (companyId == 12 && userId == 49) {
        return res.status(200).json({ message: "Comunicarse con la logística." });
    }

    try {
        const company = await getCompanyById(companyId);

        const result = await desasignar(company, userId, JSON.parse(dataQr), deviceFrom);

        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

export default asignaciones;