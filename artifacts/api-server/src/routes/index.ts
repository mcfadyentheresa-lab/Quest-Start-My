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
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

// Public routes (no auth)
router.use(healthRouter);

// Everything below this line requires auth (Clerk mode) or owner-mode fallback.
router.use(requireAuth);

router.use(pillarsRouter);
router.use(milestonesRouter);
router.use(tasksRouter);
router.use(weeklyRouter);
router.use(progressRouter);
router.use(dashboardRouter);
router.use(monthlyRouter);
router.use(frictionRouter);

export default router;
