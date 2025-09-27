const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const swaggerUi = require('swagger-ui-express');
const specs = require('./swagger/swagger');

dotenv.config();
connectDB();

const app = express();
app.use(express.json());

// Routes
app.use('/auth', authRoutes);

// Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));