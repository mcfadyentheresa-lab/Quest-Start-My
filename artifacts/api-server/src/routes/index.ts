import { Router, type IRouter } from "express";
import healthRouter from "./health";
import pillarsRouter from "./pillars";
import milestonesRouter from "./milestones";
import tasksRouter from "./tasks";
import weeklyRouter from "./weekly";
import progressRouter from "./progress";
import dashboardRouter from "./dashboard";
import monthlyRouter from "./monthly";
import frictionRouter from "./friction";

const router: IRouter = Router();

router.use(healthRouter);
router.use(pillarsRouter);
router.use(milestonesRouter);
router.use(tasksRouter);
router.use(weeklyRouter);
router.use(progressRouter);
router.use(dashboardRouter);
router.use(monthlyRouter);
router.use(frictionRouter);

export default router;
