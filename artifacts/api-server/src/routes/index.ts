import { Router, type IRouter } from "express";
import healthRouter from "./health";
import pillarsRouter from "./pillars";
import milestonesRouter from "./milestones";
import tasksRouter from "./tasks";
import weeklyRouter from "./weekly";
import progressRouter from "./progress";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(pillarsRouter);
router.use(milestonesRouter);
router.use(tasksRouter);
router.use(weeklyRouter);
router.use(progressRouter);
router.use(dashboardRouter);

export default router;
