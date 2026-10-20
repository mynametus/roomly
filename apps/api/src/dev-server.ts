import app from "./application.js";

const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  console.log(`Roomly API đang chạy tại http://localhost:${port}`);
});
