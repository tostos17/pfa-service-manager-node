import { AppDataSource } from '../config/database';
import fs from 'fs';
import path from 'path';

async function generate() {
    try {
        console.log("Connecting to the database to inspect metadata...");
        await AppDataSource.initialize();
        
        console.log("Compiling schema creation queries...");
        const builder = AppDataSource.driver.createSchemaBuilder();
        const log = await builder.log();
        
        // Join all 'up' queries with a semicolon and newlines
        const sql = log.upQueries.map(q => q.query + ";").join("\n\n");
        
        const outputPath = path.join(__dirname, '../../schema.sql');
        fs.writeFileSync(outputPath, sql);
        
        console.log("\n=======================================================");
        console.log(`Success! Database schema saved to:`);
        console.log(`${outputPath}`);
        console.log("=======================================================\n");
    } catch (error) {
        console.error("Failed to generate database schema SQL:", error);
    } finally {
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
        }
    }
}

generate();
