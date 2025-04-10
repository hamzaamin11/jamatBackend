// import mysql from "mysql2/promise";
// import dotenv from "dotenv";

// dotenv.config();

// const pool = mysql.createPool({
//   connectionLimit: 10,
//   host: process.env.DB_HOST || "147.93.122.109",
//   user: process.env.DB_USER || "tech_UseRMemEentS",
//   password: process.env.DB_PASSWORD || "tech_UseRMemEentS",
//   database: process.env.DB_NAME || "tech_MemberEvents",
// });

// export default pool;
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const pool = mysql.createPool({
  connectionLimit: 10,
  host: "localhost",
  user: "root",
  password: "root",
  database: "ems",
});

export default pool;
