





export function filtrar_proceso(req) {
    if (companyId == 12 && userId == 49) {
        return res.status(Status.conflict).json({ message: "Comunicarse con la logística." });
    }

    if (company.did == 4) {
        let result = await verifyAssignment(
            company,
            userId,
            profile,
            dataQr,
            driverId,
            deviceFrom,
            req.body
        );
    } else {
        result = await asignar(
            company,
            userId,
            dataQr,
            driverId,
            deviceFrom,
            startTime
        );
    }
}