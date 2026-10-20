import express from "express";
import app from "./src/application.js";

const handler: ReturnType<typeof express> = app;

export default handler;
