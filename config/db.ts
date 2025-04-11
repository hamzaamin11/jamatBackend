// import mysql from "mysql2/promise";

// import dotenv from "dotenv";

// dotenv.config();

// const pool = mysql.createPool({
//   connectionLimit: 10,
//   host: process.env.DB_HOST || "147.93.122.109",
//   user: process.env.DB_USER || "u334339390_UseRMemEentS",
//   password: process.env.DB_PASSWORD || "MeMbEr@123",
//   database: process.env.DB_NAME || "u334339390_MemberEvents",
// });

// export default pool;
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const pool = mysql.createPool({
  connectionLimit: 10,
  host: "sql7.freesqldatabase.com",
  user: "sql7772441",
  password: "mhS6Hcx4qJ",
  database: "sql7772441",
  port: 3306,
  connectTimeout: 30000,
});

export default pool;
