let io;
exports.setIO = (server) => { io = server; };
exports.emitDelivery = (deliveryId, event, data) => { if (io) io.to(`delivery:${deliveryId}`).emit(event, data); };
