import { Router, type IRouter } from "express";
import healthRouter from "./health";
import areasRouter from "./areas";
import milestonesRouter from "./milestones";
import tasksRouter from "./tasks";
import weeklyRouter from "./weekly";
import progressRouter from "./progress";
import dashboardRouter from "./dashboard";
import monthlyRouter from "./monthly";
import frictionRouter from "./friction";
import dailyRouter from "./daily";
import briefingRouter from "./briefing";

const router: IRouter = Router();

router.use(healthRouter);
router.use(areasRouter);
router.use(milestonesRouter);
router.use(tasksRouter);
router.use(weeklyRouter);
router.use(progressRouter);
router.use(dashboardRouter);
router.use(monthlyRouter);
router.use(frictionRouter);
router.use(dailyRouter);
router.use(briefingRouter);

export default router;
