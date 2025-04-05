import express, { Application, Request, Response } from "express";
import {
  addDistrict,
  addEvent,
  addZone,
  deleteDistrict,
  deleteEvent,
  deleteMember,
  deleteZone,
  endEvent,
  getDistrict,
  getEvent,
  getEventById,
  getJoinMembers,
  getLeaveMembers,
  getMembers,
  getZone,
  joinEvent,
  login,
  registerMember,
  searchEvent,
  searchEventDetail,
  searchMember,
  startEvent,
  updateDistrict,
  updateEvent,
  updateMember,
  updateZone,
} from "../controllers/userController";
import { authenticateToken } from "../middleware/authMiddleware";

export default (app: Application): void => {
  //login routes:
  app.post("/login", login);

  app.post("/user/registerMember", registerMember);

  app.get("/user/getMembers", getMembers);

  app.patch("/user/deleteMember/:id", deleteMember);

  app.put("/user/updateMember/:id", updateMember);

  app.post("/user/addDistrict", addDistrict);

  app.get("/user/getDistrict", getDistrict);

  app.put("/user/updateDistrict/:id", updateDistrict);

  app.patch("/user/deleteDistrict/:id", deleteDistrict);

  app.get("/user/getZone", getZone);

  app.post("/user/addZone", addZone);

  app.put("/user/updateZone/:id", updateZone);

  app.patch("/user/deleteZone/:id", deleteZone);

  app.post("/user/addEvent", addEvent);

  app.get("/user/getEvent/:entry", getEvent);

  app.put("/user/updateEvent/:id", updateEvent);

  app.patch("/user/deleteEvent/:id", deleteEvent);

  app.get("/user/searchEvent", searchEvent);

  app.get("/user/getEventById/:id", getEventById);

  app.post("/user/startEvent/:eventId", startEvent);

  app.get("/user/searchMember", searchMember);

  app.post("/user/joinEvent/:eventId/:memberId", joinEvent);

  app.get("/user/getJoinMembers", getJoinMembers);

  app.get("/user/searchEventDetail", searchEventDetail);

  app.post("/user/endEvent/:id", endEvent);

  app.get("/user/getLeaveMembers", getLeaveMembers);
};
