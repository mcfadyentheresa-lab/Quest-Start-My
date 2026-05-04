import { Router, type IRouter } from "express";
import { buildAuthRouter } from "../lib/auth";
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
import recapRouter from "./recap";
import reflectionsRouter from "./reflections";
import yearRibbonRouter from "./year-ribbon";
import recurringTasksRouter from "./recurring-tasks";

const router: IRouter = Router();

router.use(buildAuthRouter());
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
router.use(recapRouter);
router.use(reflectionsRouter);
router.use(yearRibbonRouter);
router.use(recurringTasksRouter);

export default router;
