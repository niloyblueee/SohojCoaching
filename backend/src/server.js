import { createApp, prisma } from './app.js';
import { startFeeScheduler } from './services/feeSchedulerService.js';

const PORT = process.env.PORT || 3000;

export async function startServer() {
    const app = createApp();

    try {
        await prisma.$connect();
        console.log('Successfully connected to the database.');
        startFeeScheduler(prisma);
        console.log('Monthly fee scheduler started.');

        const server = app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });

        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`Port ${PORT} is already in use. Update PORT in .env or stop the running process.`);
            } else {
                console.error('Server startup error:', error.message);
            }
            process.exit(1);
        });
    } catch (error) {
        console.error('Failed to connect to the database. Exiting...', error);
        process.exit(1);
    }
}
