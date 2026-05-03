import { Router, type IRouter } from "express";
import healthRouter from "./health";
import lunaRouter from "./luna";

const router: IRouter = Router();

router.use(healthRouter);
router.use(lunaRouter);

export default router;
