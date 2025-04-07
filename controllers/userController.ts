import { Request, Response } from "express";
import pool from "../config/db";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import fs from "fs";
import path from "path";

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    console.log("Login Attempt - Email:", email, "Password:", password);

    const [users]: any = await pool.query(
      "SELECT * FROM tbl_user WHERE email = ?",
      [email]
    );

    if (!users || users.length === 0) {
      console.log("❌ User not found");
      res
        .status(400)
        .json({ status: 400, message: "Invalid Username or Password" });
      return;
    }

    const user = users[0];
    let storedPassword = user.password;

    if (!storedPassword) {
      console.error("Database Error: Password field is missing");
      res.status(500).json({ status: 500, message: "Internal Server Error" });
      return;
    }

    const isHashed = storedPassword.startsWith("$2b$");

    if (!isHashed) {
      console.log("Hashing plain text password...");
      const hashedPassword = await bcrypt.hash(storedPassword, 10);

      await pool.query("UPDATE tbl_user SET password = ? WHERE email = ?", [
        hashedPassword,
        email,
      ]);
      console.log("Password successfully hashed and updated.");

      storedPassword = hashedPassword;
    }

    const isMatch = await bcrypt.compare(password, storedPassword);
    if (!isMatch) {
      console.log("❌ Password does not match");
      res
        .status(400)
        .json({ status: 400, message: "Invalid Username or Password" });
      return;
    }

    const token = jwt.sign(
      { email: user.email, role: user.role },
      process.env.JWT_SECRET || "default_secret",
      { expiresIn: "1h" }
    );

    console.log("Login Successful - User:", user.email);
    res.status(200).send({
      token,
      id: user.id,
      name: user.name,
      email: user.email,
      password: user.password,
      mobileNumber: user.mobileNumber,
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

/*register member*/

export const registerMember = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      zone,
      profession,
      image,
      mobileNumber,
      fullName,
      fatherName,
      email,
      education,
      dob,
      district,
      cnic,
      age,
      address,
    } = req.body;

    if (
      !zone ||
      !profession ||
      !mobileNumber ||
      !fullName ||
      !fatherName ||
      !email ||
      !education ||
      !dob ||
      !cnic ||
      !age ||
      !address ||
      !district
    ) {
      res.json({ message: "All fields are required!" });
      return;
    }

    const query = `
      INSERT INTO tbl_members (
        fullName,
          fatherName,
          zone,
          mobileNumber,
          address,
          education,
          email,
          cnic,
          dob,
          district,
          age, 
          profession,
          image
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

    const values = [
      fullName,
      fatherName,
      zone,
      mobileNumber,
      address,
      education,
      email,
      cnic,
      dob,
      district,
      age,
      profession,
      image,
    ];

    const [result]: any = await pool.query(query, values);

    const [getResult]: any = await pool.query(
      `select * from tbl_members where email = ?`,
      [email]
    );
    res.status(201).json(req.body);
  } catch (error) {
    console.error(" Error adding a member:", error);
    res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

export const getMemberImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const memberId = req.params.id;

    const [rows]: any = await pool.query("SELECT image FROM tbl_members WHERE id = ?", [memberId]);

    if (!rows || rows.length === 0) {
      res.status(404).json({ message: "Member not found" });
      return;
    }

    const imagePath = rows[0].image;

    if (!fs.existsSync(imagePath)) {
      res.status(404).json({ message: "Image file not found on server" });
      return;
    }

    const absolutePath = path.resolve(imagePath);
    res.sendFile(absolutePath);
  } catch (error) {
    console.error("Error fetching image:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const uploadImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const uploadedImage = (req as MulterRequest).file;

    if (!uploadedImage) {
      res.status(400).json({ message: "No image file uploaded" });
      return;
    }

    const imagePath = path.join("uploads/images/", uploadedImage.filename);

    res.status(200).json({
      message: "Image uploaded successfully",
      imagePath,
    });
  } catch (error) {
    console.error("Image upload error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

/*get members*/
export const getMembers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1; // Get page number, default to 1
    const limit = 10; // Show 10 entries per page
    const offset = (page - 1) * limit; // Calculate offset for pagination

    const [query]: any = await pool.query(
      `
          SELECT 
              id, 
              fullName, 
              fatherName, 
              zone, 
              mobileNumber, 
              address, 
              education, 
              email, 
              cnic, 
              district, 
              age, 
              profession, 
             image, 
              DATE_FORMAT(CONVERT_TZ(dob, '+00:00', @@session.time_zone), '%Y-%m-%d') AS dob
          FROM tbl_members
          WHERE status = 'Y'
          LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    // Fetch total number of entries for pagination info
    const [countResult]: any = await pool.query(`
          SELECT COUNT(*) AS total FROM tbl_members WHERE status = 'Y'
      `);
    const totalEntries = countResult[0].total;
    const totalPages = Math.ceil(totalEntries / limit);

    if (!query || query.length === 0) {
      res.status(404).json({ message: "No users found!" });
      return;
    }

    res.status(200).json(query);
  } catch (error) {
    console.error("❌ Error fetching members:", error);
    res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

/*Delete member */

export const deleteMember = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const [member]: any = await pool.query(
      `SELECT * FROM tbl_members WHERE id = ?`,
      [id]
    );
    if (!member.length) {
      res.status(404).json({ message: "Member not found!" });
    }

    await pool.query(`UPDATE tbl_members SET status = 'N' WHERE id = ?`, [id]);

    const [updatedMember]: any = await pool.query(
      `SELECT * FROM tbl_members WHERE id = ?`,
      [id]
    );

    res.status(200).json(updatedMember[0]);
  } catch (error) {
    console.error("❌ Error deleting member:", error);
    res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

/* update member */

export const updateMember = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      zone,
      profession,
      image,
      mobileNumber,
      fullName,
      fatherName,
      email,
      education,
      dob,
      district,
      cnic,
      age,
      address,
    } = req.body;

    if (
      !zone ||
      !profession ||
      !image ||
      !mobileNumber ||
      !fullName ||
      !fatherName ||
      !email ||
      !education ||
      !dob ||
      !cnic ||
      !age ||
      !address
    ) {
      res.status(400).json({ message: "All fields are required!" });
      return;
    }

    const [existingMember]: any = await pool.query(
      `SELECT * FROM tbl_members WHERE id = ?`,
      [id]
    );
    if (existingMember.length === 0) {
      res.status(404).json({ message: "Member not found!" });
      return;
    }

    const query = `
          UPDATE tbl_members SET
          fullName = ?,
          fatherName = ?,
          zone = ?,
          mobileNumber = ?,
          address = ?,
          education = ?,
          email = ?,
          cnic = ?,
          dob = ?,
          district = ?,
          age = ?, 
          profession = ?,
          image =?
          WHERE id = ?
      `;

    const values = [
      fullName,
      fatherName,
      zone,
      mobileNumber,
      address,
      education,
      email,
      cnic,
      dob.split("T")[0],
      district,
      age,
      profession,
      image,
      id,
    ];

    const [result]: any = await pool.query(query, values);

    if (result.affectedRows === 0) {
      res.status(500).json({ message: "Failed to update member." });
      return;
    }

    const [updatedMember]: any = await pool.query(
      `SELECT * FROM tbl_members WHERE id = ?`,
      [id]
    );

    res.status(200).json(updatedMember[0]);
  } catch (error) {
    console.error(" Error updating member:", error);
    res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

/* add district */

export const addDistrict = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { district } = req.body;
    if (!district) {
      res.send({ message: "add District!" });
      return;
    }

    const [query]: any = await pool.query(
      `insert into tbl_configuration (district) values (?)`,
      [district]
    );
    const [getUpdated]: any = await pool.query(
      `select * from tbl_configuration where district = ?`,
      [district]
    );

    res.status(200).send(getUpdated);
  } catch (error) {
    console.error(" Error adding district!:", error);
    res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

/* get district */

export const getDistrict = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const [query]: any = await pool.query(
      `SELECT id, district 
      FROM tbl_configuration 
      WHERE status = 'Y' 
      AND district IS NOT NULL`
    );

    res.status(200).send(query);
  } catch (error) {
    console.error(" Error getting district!:", error);
    res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

/* update district */

export const updateDistrict = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = req.params.id;
    const { district } = req.body;

    if (!id || !district) {
      res.send({ message: "Please Provide district information!" });
      return;
    }

    const [update]: any = await pool.query(
      `update tbl_configuration set district = ? where id  = ?`,
      [district, id]
    );
    const [getUpdated]: any = await pool.query(
      `select * from tbl_configuration where id = ?`,
      [id]
    );

    res.status(200).send(getUpdated);
  } catch (error) {
    console.error(" Error getting district!:", error);
    res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

/* delete district */

export const deleteDistrict = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = req.params.id;
    if (!id) {
      res.send({ message: "Please provide an ID!" });
      return;
    }

    const [deleteQuery]: any = await pool.query(
      `update tbl_configuration set status = 'N' where id = ?`,
      [id]
    );
    const [getUpdated]: any = await pool.query(
      `select * from tbl_configuration where id = ?`,
      [id]
    );

    res.status(200).send(getUpdated);
  } catch (error) {
    console.error(" Error deleting district!:", error);
    res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

/* Add zone */

export const addZone = async (req: Request, res: Response): Promise<void> => {
  try {
    const { zone } = req.body;
    if (!zone) {
      res.send({ message: "add Zone!" });
      return;
    }

    const [query]: any = await pool.query(
      `insert into tbl_configuration (zone) values (?)`,
      [zone]
    );

    const [getZone]: any = await pool.query(
      `select * from tbl_configuration where zone = ?`,
      [zone]
    );
    res.status(200).send(getZone);
  } catch (error) {
    console.error(" Error adding Zone!:", error);
    res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

/* Get zone */

export const getZone = async (req: Request, res: Response): Promise<void> => {
  try {
    const [query]: any = await pool.query(
      `SELECT id, zone 
        FROM tbl_configuration 
        WHERE status = 'Y' 
        AND zone IS NOT NULL`
    );
    res.status(200).send(query);
  } catch (error) {
    console.error(" Error getting Zone!:", error);
    res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

/* update zone */

export const updateZone = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = req.params.id;
    const { zone } = req.body;

    if (!id || !zone) {
      res.send({ message: "Please Provide Zone information!" });
      return;
    }

    const [update]: any = await pool.query(
      `update tbl_configuration set zone = ? where id  = ?`,
      [zone, id]
    );

    const [getUpdated]: any = await pool.query(
      `select * from tbl_configuration where id = ?`,
      [id]
    );

    res.status(200).send(update);
  } catch (error) {
    console.error(" Error getting Zone!:", error);
    res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

/* delete zone */

export const deleteZone = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = req.params.id;
    if (!id) {
      res.send({ message: "Please provide an ID!" });
      return;
    }

    const [deleteQuery]: any = await pool.query(
      `update tbl_configuration set status = 'N' where id = ?`,
      [id]
    );
    const [getUpdated]: any = await pool.query(
      `select * from tbl_configuration where id = ?`,
      [id]
    );

    res.status(200).send(getUpdated);
  } catch (error) {
    console.error(" Error deleting Zone!:", error);
    res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

/*add event */

export const addEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      eventName,
      date,
      location,
      description,
      image,
      focalPersonName,
      focalPersonNumber,
      focalPersonEmail,
      infoPersonName,
      infoPersonNumber,
      infoPersonEmail,
      eventType,
    } = req.body;

    const [existingEvent]: any = await pool.query(
      `select * from tbl_event where eventName= ?`,
      [eventName]
    );

    if (existingEvent.lenght > 0) {
      res.send({ message: "Event already Exist!" });
      return;
    }
    if (
      !eventName ||
      !date ||
      !location ||
      !focalPersonName ||
      !focalPersonNumber ||
      !focalPersonEmail
    ) {
      res.status(400).send({ message: "Provide all required fields!" });
      return;
    }

    const query = `insert into tbl_event (
          eventName,
          date,
          location,
          description,
          image,
          focalPersonName,
          focalPersonNumber,
          focalPersonEmail,
          infoPersonName,
          infoPersonNumber,
          infoPersonEmail,
          eventType
          ) values (?,?,?,?,?,?,?,?,?,?,?,?)`;

    const values = [
      eventName,
      date,
      location,
      description,
      image,
      focalPersonName,
      focalPersonNumber,
      focalPersonEmail,
      infoPersonName,
      infoPersonNumber,
      infoPersonEmail,
      eventType,
    ];

    const [result]: any = await pool.query(query, values);
    const [getEvents]: any = await pool.query(
      `select *,                 
                  DATE_FORMAT(CONVERT_TZ(date, '+00:00', @@session.time_zone), '%Y-%m-%d') AS currentDate
                  from tbl_event where eventName = ? `,
      [eventName]
    );
    res.status(200).send({ ...getEvents[0] });
  } catch (error) {
    console.error(" Error adding event!:", error);
    res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

/*get event */

export const getEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const entry = parseInt(req.params.entry, 10);
    const limit = !isNaN(entry) && entry > 0 ? entry : 10;
    const [query]: any = await pool.query(
      `select *,                 
          DATE_FORMAT(CONVERT_TZ(date, '+00:00', @@session.time_zone), '%Y-%m-%d') AS currentDate
          from tbl_event where eventStatus = 'Y' limit ?`,
      [limit]
    );
    if (query.lenght === 0) {
      res.send({ message: "No Event Added yet!" });
      return;
    }

    res.status(200).send(query);
  } catch (error) {
    console.error(" Error adding event!:", error);
    res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

export const updateEvent = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = req.params.id;
    const {
      eventName,
      date,
      location,
      description,
      image,
      focalPersonName,
      focalPersonNumber,
      focalPersonEmail,
      infoPersonName,
      infoPersonNumber,
      infoPersonEmail,
      eventType,
    } = req.body;

    if (
      !eventName ||
      !date ||
      !location ||
      !focalPersonName ||
      !focalPersonNumber ||
      !focalPersonEmail
    ) {
      res.status(400).send({ message: "Provide all required fields!" });
      return;
    }

    const [checkExisting]: any = await pool.query(
      `SELECT *, 
          DATE_FORMAT(CONVERT_TZ(date, '+00:00', @@session.time_zone), '%Y-%m-%d') AS currentDate
          FROM tbl_event WHERE id = ?`,
      [id]
    );
    if (checkExisting.length === 0) {
      res.status(404).send({ message: "No Event Found to be updated!" });
      return;
    }

    const query = `
          UPDATE tbl_event SET 
              eventName = ?, 
              date = ?, 
              location = ?, 
              description = ?, 
              image = ?, 
              focalPersonName = ?, 
              focalPersonNumber = ?, 
              focalPersonEmail = ?, 
              infoPersonName = ?, 
              infoPersonNumber = ?, 
              infoPersonEmail = ?, 
              eventType = ? 
          WHERE id = ?
      `;

    const values = [
      eventName,
      date,
      location,
      description,
      image,
      focalPersonName,
      focalPersonNumber,
      focalPersonEmail,
      infoPersonName,
      infoPersonNumber,
      infoPersonEmail,
      eventType,
      id,
    ];

    const [update]: any = await pool.query(query, values);

    const [getEntry]: any = await pool.query(
      `select *,
      DATE_FORMAT(CONVERT_TZ(date, '+00:00', @@session.time_zone), '%Y-%m-%d') AS currentDate
      from tbl_event where id = ?`,
      [id]
    );

    res.status(200).send({ ...getEntry[0] });
  } catch (error) {
    console.error("Error updating event:", error);
    res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

export const deleteEvent = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = req.params.id;

    const [event]: any = await pool.query(
      `SELECT *,
          DATE_FORMAT(CONVERT_TZ(date, '+00:00', @@session.time_zone), '%Y-%m-%d') AS currentDate
          FROM tbl_event WHERE id = ?`,
      [id]
    );

    if (event.length === 0) {
      res.status(404).json({ message: "No Event Found to delete!" });
      return;
    }

    await pool.query(`UPDATE tbl_event SET eventStatus = 'N' WHERE id = ?`, [
      id,
    ]);

    res.status(200).send({ ...event[0] });
  } catch (error) {
    console.error("Error deleting event:", error);
    res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

/*Search event */

export const searchEvent = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const searchQuery = req.query.q as string;

    if (!searchQuery) {
      res.status(400).json({ message: "Search query is required!" });
      return;
    }

    const sql = `
          SELECT 
              id,
              eventName, 
              location, 
              description, 
              image, 
              focalPersonName, 
              focalPersonNumber, 
              focalPersonEmail, 
              infoPersonName, 
              infoPersonNumber, 
              infoPersonEmail, 
              eventType, 
              startTime, 
              endTime, 
              presentTime, 
              eventStatus, 
              DATE_FORMAT(CONVERT_TZ(date, '+00:00', @@session.time_zone), '%Y-%m-%d') AS currentDate
          FROM tbl_event 
          WHERE 
              (eventName LIKE ? OR 
              location LIKE ? OR 
              description LIKE ? OR 
              focalPersonName LIKE ? OR 
              focalPersonEmail LIKE ? OR 
              infoPersonName LIKE ? OR 
              infoPersonEmail LIKE ?) 
          AND eventStatus = 'Y' 
      `;

    const values = Array(7).fill(`%${searchQuery}%`); // Wildcard search for multiple fields
    const [results]: any = await pool.query(sql, values);

    res.json(results);
  } catch (error) {
    console.error("Error searching events:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

/*get event */

export const getEventById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = req.params.id;
    const [query]: any = await pool.query(
      `select * from tbl_event where id = ?`,
      [id]
    );

    res.status(200).send({ ...query[0] });
  } catch (error) {
    console.error("Error fetching event Detail:", error);
    res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

/*start event */
export const startEvent = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const eventId = req.params.eventId;
    console.log(eventId, req.body);
    const [checkEvent]: any = await pool.query(
      `SELECT * FROM tbl_events_detail WHERE eventId = ?`,
      [eventId]
    );

    const [checkEndTime]: any = await pool.query(
      `SELECT startTime, endTime FROM tbl_event WHERE id = ?`,
      [eventId]
    );

    if (checkEvent.length === 0 || !checkEndTime[0]?.startTime) {
      await pool.query(`INSERT INTO tbl_events_detail (eventId) VALUES (?)`, [
        eventId,
      ]);

      await pool.query(
        `UPDATE tbl_event SET startTime = CURRENT_TIMESTAMP WHERE id = ?`,
        [eventId]
      );

      // res.send({ message: "Start Time recorded Successfully!" });
    }

    const [result]: any = await pool.query(
      `SELECT * FROM tbl_event WHERE id = ?`,
      [eventId]
    );

    res.status(200).json({ ...result[0] });
  } catch (error) {
    console.error("Error Creating event!:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

/*search event */

export const searchMember = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const searchQuery = req.query.q as string;
    if (!searchQuery) {
      res.status(400).json({ message: "Search query is required!" });
      return;
    }
    const sql = `
    SELECT
        m.id,
        e.id as eventId,
        m.fullName,
        m.fatherName,
        m.zone,
        m.mobileNumber,
        m.address,
        m.education,
        m.email,
        m.cnic,
        m.district,
        m.age,
        m.profession,
        DATE_FORMAT(NOW(), '%h:%i %p') AS currentTime
    FROM tbl_members m
    left join tbl_event e on
    m.id = e.id
    WHERE
        (fullName LIKE ? OR
        fatherName LIKE ? OR
        zone LIKE ? OR
        mobileNumber LIKE ? OR
        address LIKE ? OR
        education LIKE ? OR
        email LIKE ? OR
        cnic LIKE ? OR
        district LIKE ? OR
        profession LIKE ?)
    AND status = 'Y' AND joinStatus = 'Y'
`;
    const values = Array(10).fill(`%${searchQuery}%`);
    const [results]: any = await pool.query(sql, values);

    res.json(results);
  } catch (error) {
    console.error("Error searching members:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const joinEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId, memberId } = req.params;
    if (!memberId || !eventId) {
      res.status(400).json({ message: "Provide Member Info!" });
      return;
    }
    const [checkStart]: any = await pool.query(
      `SELECT eventId FROM tbl_events_detail where eventId = ?`,
      [eventId]
    );
    if (!checkStart.length || !checkStart[0]?.eventId) {
      res.send({ message: "Please start an event to continue!" });
      return;
    }

    // ✅ Check if the member exists in tbl_members
    const [existingMember]: any = await pool.query(
      "SELECT * FROM tbl_members WHERE id = ?",
      [memberId]
    );
    if (existingMember.length === 0) {
      res.status(404).json({ message: "Member not found!" });
      return;
    }
    // ✅ Check if the member has already clocked in
    const [checkClockin]: any = await pool.query(
      "SELECT memberClockin, memberClockout FROM tbl_events_detail WHERE memberId = ? AND eventId = ?",
      [memberId, eventId]
    );
    console.log("Fetched Attendance:", checkClockin);
    // ✅ If user has never clocked in, add them and set clock-in time
    if (!checkClockin[0]) {
      await pool.query(
        `INSERT INTO tbl_events_detail (eventId, memberId, memberClockin, eventStatus)
  VALUES (?, ?, CURRENT_TIMESTAMP(), 'Join')`,
        [eventId, memberId]
      );
      await pool.query(`update tbl_members set joinStatus = 'N' where id = ?`, [
        memberId,
      ]);
      const [clockinData]: any = await pool.query(
        `select * from tbl_members where id = ?`,
        [memberId]
      );
      const data = clockinData[0];
      res.status(200).json(data); // Now this will return just the object, not an object inside an object
      return;
    }
    // ---------->
    // ✅ If user already clocked in but not clocked out, proceed with clock-out
    if (checkClockin[0].memberClockout === null) {
      await pool.query(
        `UPDATE tbl_events_detail
  SET memberClockout = CURRENT_TIMESTAMP(), eventStatus = 'Leave'
  WHERE eventId = ? AND memberId = ?`,
        [eventId, memberId]
      );
      // ✅ Re-fetch updated data
      const [updatedEvent]: any = await pool.query(
        "SELECT memberClockin, memberClockout FROM tbl_events_detail WHERE memberId = ? AND eventId = ?",
        [memberId, eventId]
      );
      if (!updatedEvent[0].memberClockout) {
        res.status(400).json({ message: "Clock-out time update failed." });
        return;
      }
      // ✅ Calculate Working Hours
      const [timeDiffResult]: any = await pool.query(
        `SELECT
  LPAD(TIMESTAMPDIFF(HOUR, memberClockin, memberClockout), 2, '0') AS Hours,
  LPAD(TIMESTAMPDIFF(MINUTE, memberClockin, memberClockout) % 60, 2, '0') AS Minutes
  FROM tbl_events_detail WHERE memberId = ? AND eventId = ?`,
        [memberId, eventId]
      );
      console.log("Working Hours Calculation:", timeDiffResult);
      const { Hours, Minutes } = timeDiffResult[0] || {
        Hours: "0",
        Minutes: "00",
      };
      // ✅ Format Hours & Minutes
      let formattedWorkingHours = "";
      if (Hours !== "00" && Hours !== "0") {
        formattedWorkingHours += `${Hours} Hour${Hours !== "1" ? "s" : ""} `;
      }
      if (Minutes !== "00") {
        formattedWorkingHours += `${Minutes} Minute${
          Minutes !== "1" ? "s" : ""
        }`;
      }
      if (!formattedWorkingHours) {
        formattedWorkingHours = "0 Minutes"; // Default if both are 0
      }
      console.log(`Final Working Hours: ${formattedWorkingHours}`);
      // ✅ Update `workingHours` field
      await pool.query(
        `UPDATE tbl_events_detail
  SET presentHours = ?
  WHERE memberId = ? AND eventId = ?`,
        [formattedWorkingHours.trim(), memberId, eventId]
      );

      const [finalData]: any = await pool.query(
        "SELECT * FROM tbl_events_detail WHERE memberId = ? AND eventId = ?",
        [memberId, eventId]
      );
      res.status(200).json(finalData);
      return;
    }
    // ✅ If user has already clocked out, prevent re-clock-out
    res.status(400).json({
      message: "You have already clocked out!",
    });
  } catch (error) {
    console.error("Error processing attendance:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getJoinMembers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const eventId = req.params.eventId;
    const page = parseInt(req.query.page as string, 10) || 1; // Default page = 1
    const limit = 10; // Show 10 entries per page
    const offset = (page - 1) * limit; // Calculate offset for pagination
    // Fetch paginated joined members with JOIN
    const [query]: any = await pool.query(
      `SELECT e.*, m.*
  FROM tbl_events_detail e
  JOIN tbl_members m ON e.memberId = m.id
  WHERE e.eventStatus = 'Join' and eventId = ?
  LIMIT ? OFFSET ?`,
      [eventId, limit, offset]
    );
    // Fetch total number of join members for pagination info
    const [countResult]: any = await pool.query(
      `SELECT COUNT(*) AS total
  FROM tbl_events_detail
  WHERE eventStatus = 'Join'`
    );
    const totalEntries = countResult[0].total;
    const totalPages = Math.ceil(totalEntries / limit);
    if (query.length === 0) {
      res.status(404).json({ message: "No joined members found!" });
      return;
    }
    res.status(200).json(query);
  } catch (error) {
    console.error("❌ Error fetching joined members:", error);
    res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

export const searchEventDetail = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const searchQuery = req.query.q as string;
    if (!searchQuery) {
      res.status(400).json({ message: "Search query is required!" });
      return;
    }

    const sql = `
          SELECT 
              ed.*, 
              m.*,
              e.eventName, 
              e.date 
          FROM tbl_events_detail ed
          JOIN tbl_members m ON m.id = ed.memberId
          JOIN tbl_event e ON ed.eventId = e.id
          WHERE 
              (e.eventName LIKE ? OR 
              m.fullName LIKE ? OR 
              m.mobileNumber LIKE ? OR 
              e.date LIKE ?) 
              AND ed.eventStatus = 'Join' 
      `;

    const values = Array(4).fill(`%${searchQuery}%`);
    const [results]: any = await pool.query(sql, values);

    res.json(results);
  } catch (error) {
    console.error("Error searching event details:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const endEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const eventId = req.params.id;
    const { endNote } = req.body;

    if (!eventId) {
      res.status(400).json({ message: "Please provide the event ID!" });
      return;
    }

    // ✅ Fetch event start and end time
    const [checkEndTime]: any = await pool.query(
      `SELECT startTime, endTime FROM tbl_event WHERE id = ?`,
      [eventId]
    );

    if (!checkEndTime[0]) {
      res.status(404).json({ message: "Event not found!" });
      return;
    }

    // ✅ If endTime is NULL or default, update it
    if (!checkEndTime[0].endTime || checkEndTime[0].endTime === "00:00:00") {
      await pool.query(
        `UPDATE tbl_event SET endTime = CURRENT_TIMESTAMP WHERE id = ?`,
        [eventId]
      );
    }

    // ✅ Calculate event duration
    const [timeDiffResult]: any = await pool.query(
      `SELECT 
          LPAD(TIMESTAMPDIFF(HOUR, startTime, endTime), 2, '0') AS Hours,
          LPAD(TIMESTAMPDIFF(MINUTE, startTime, endTime) % 60, 2, '0') AS Minutes
      FROM tbl_event WHERE id = ?`,
      [eventId]
    );

    const { Hours, Minutes } = timeDiffResult[0] || {
      Hours: "0",
      Minutes: "00",
    };
    let formattedWorkingHours = `${
      Hours !== "00" ? Hours + " Hour" + (Hours !== "1" ? "s " : " ") : ""
    }`;
    formattedWorkingHours += `${
      Minutes !== "00" ? Minutes + " Minute" + (Minutes !== "1" ? "s" : "") : ""
    }`;
    if (!formattedWorkingHours) formattedWorkingHours = "0 Minutes";

    // ✅ Update event present time
    await pool.query(`UPDATE tbl_event SET presentTime = ? WHERE id = ?`, [
      formattedWorkingHours.trim(),
      eventId,
    ]);

    // ✅ Add end note to event
    await pool.query(`UPDATE tbl_event SET endNote = ? WHERE id = ?`, [
      endNote,
      eventId,
    ]);

    // ✅ Fetch all members who haven't clocked out yet
    const [members]: any = await pool.query(
      `SELECT memberId FROM tbl_events_detail WHERE eventId = ? AND memberClockout IS NULL`,
      [eventId]
    );

    // ✅ Loop through each member to clock them out and calculate working hours
    for (const member of members) {
      const memberId = member.memberId;

      await pool.query(
        `UPDATE tbl_events_detail 
         SET memberClockout = CURRENT_TIMESTAMP, eventStatus = 'End'
         WHERE eventId = ? AND memberId = ?`,
        [eventId, memberId]
      );

      // ✅ Calculate individual working hours
      const [timeDiff]: any = await pool.query(
        `SELECT 
            LPAD(TIMESTAMPDIFF(HOUR, memberClockin, memberClockout), 2, '0') AS Hours,
            LPAD(TIMESTAMPDIFF(MINUTE, memberClockin, memberClockout) % 60, 2, '0') AS Minutes
        FROM tbl_events_detail WHERE memberId = ? AND eventId = ?`,
        [memberId, eventId]
      );

      const { Hours: memberHours, Minutes: memberMinutes } = timeDiff[0] || {
        Hours: "0",
        Minutes: "00",
      };

      let memberFormattedHours = `${
        memberHours !== "00"
          ? memberHours + " Hour" + (memberHours !== "1" ? "s " : " ")
          : ""
      }`;
      memberFormattedHours += `${
        memberMinutes !== "00"
          ? memberMinutes + " Minute" + (memberMinutes !== "1" ? "s" : "")
          : ""
      }`;
      if (!memberFormattedHours) memberFormattedHours = "0 Minutes";

      // ✅ Update presentHours for each member
      await pool.query(
        `UPDATE tbl_events_detail 
         SET presentHours = ?
         WHERE memberId = ? AND eventId = ?`,
        [memberFormattedHours.trim(), memberId, eventId]
      );
    }

    await pool.query(
      `update tbl_events_detail set eventStatus = 'End' where eventId = ?`,
      [eventId]
    );
    await pool.query(
      `update tbl_events_detail set eventStatus = 'End' where eventStatus = 'Leave' `
    );

    await pool.query(
      `update tbl_members set joinStatus = 'Y' where joinStatus = 'N'`
    );

    // ✅ Fetch final event details
    const [endedEvent]: any = await pool.query(
      `select m.* , ed.*, e.eventName, e.startTime
      from tbl_members m
      join tbl_events_detail ed on 
      ed.memberId = m.id
      join tbl_event e on 
      e.id = ed.eventId WHERE eventId = ?`,
      [eventId]
    );

    res.status(200).json(endedEvent);
  } catch (error) {
    console.error("❌ Error processing event end:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getLeaveMembers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const eventId = req.params.eventId;
    const page = parseInt(req.query.page as string, 10) || 1; // Default page = 1
    const limit = 10; // Show 10 entries per page
    const offset = (page - 1) * limit; // Calculate offset for pagination
    // Fetch paginated leave members with JOIN
    const [query]: any = await pool.query(
      `SELECT e.*, m.*
  FROM tbl_events_detail e
  JOIN tbl_members m ON e.memberId = m.id
  WHERE e.eventStatus = 'Leave' and eventId = ?
  LIMIT ? OFFSET ?`,
      [eventId, limit, offset]
    );
    // Fetch total number of leave members for pagination info
    const [countResult]: any = await pool.query(
      `SELECT COUNT (*) AS total
  FROM tbl_events_detail
  WHERE eventStatus = 'Leave'`
    );
    const totalEntries = countResult[0].total;
    const totalPages = Math.ceil(totalEntries / limit);
    if (query.length === 0) {
      res.status(404).json({ message: "No leave members found!" });
      return;
    }

    res.status(200).json(query);
  } catch (error) {
    console.error("❌ Error fetching leave members:", error);
    res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

export const getEndMembers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const eventId = req.params.eventId;
    const page = parseInt(req.query.page as string, 10) || 1; // Default page = 1
    const limit = 10; // Show 10 entries per page
    const offset = (page - 1) * limit; // Calculate offset for pagination
    // Fetch paginated joined members with JOIN
    const [query]: any = await pool.query(
      `SELECT e.*, m.*
  FROM tbl_events_detail e
  JOIN tbl_members m ON e.memberId = m.id
  WHERE e.eventStatus = 'End' and eventId = ?
  LIMIT ? OFFSET ?`,
      [eventId, limit, offset]
    );
    // Fetch total number of join members for pagination info
    const [countResult]: any = await pool.query(
      `SELECT COUNT(*) AS total
  FROM tbl_events_detail
  WHERE eventStatus = 'End'`
    );
    const totalEntries = countResult[0].total;
    const totalPages = Math.ceil(totalEntries / limit);
    if (query.length === 0) {
      res.status(404).json({ message: "No joined members found!" });
      return;
    }
    res.status(200).json(query);
  } catch (error) {
    console.error("❌ Error fetching joined members:", error);
    res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

export const searchZones = async (req: Request, res: Response): Promise<void> => {
  try {
    const searchTerm = req.query.q as string;

    if (!searchTerm) {
      res.status(400).json({ message: "Search query (q) is required" });
      return;
    }

    const [rows]: any = await pool.query(
      `SELECT DISTINCT zone FROM tbl_configuration 
       WHERE status = 'Y' AND zone IS NOT NULL AND zone LIKE ?`,
      [`%${searchTerm}%`]
    );

    res.status(200).json(rows);
  } catch (error) {
    console.error("Zone Search Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const searchDistricts = async (req: Request, res: Response): Promise<void> => {
  try {
    const searchTerm = req.query.q as string;

    if (!searchTerm) {
      res.status(400).json({ message: "Search query (q) is required" });
      return;
    }

    const [rows]: any = await pool.query(
      `SELECT DISTINCT district FROM tbl_configuration 
       WHERE status = 'Y' AND district IS NOT NULL AND district LIKE ?`,
      [`%${searchTerm}%`]
    );

    res.status(200).json(rows);
  } catch (error) {
    console.error("District Search Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};