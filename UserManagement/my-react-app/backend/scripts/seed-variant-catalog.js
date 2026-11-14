const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { seedCatalog, SEED_200_PRODUCTS } = require("../services/seedCatalogService");

module.exports = {
  seedCatalog,
  SEED_200_PRODUCTS
};

if (require.main === module) {
  seedCatalog()
    .then((result) => {
      console.log(`Seeding complete! Deleted: ${result.deleted}, Seeded: ${result.seeded}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Seed script failed:", err);
      process.exit(1);
    });
}
