const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PIOSPARES POS API',
      version: '1.0.0',
      description: 'API for multi-tenant POS system'
    },
    servers: [{ url: `http://localhost:${process.env.PORT || 5000}` }]
  },
  apis: ['./routes/*.js']  // Scan routes for JSDoc comments
};

const specs = swaggerJSDoc(options);

module.exports = specs;