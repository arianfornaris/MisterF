import { closeDb } from './database.js';
import { migrate } from './migrator.js';

migrate();
closeDb();

console.log('Database migrations completed.');
