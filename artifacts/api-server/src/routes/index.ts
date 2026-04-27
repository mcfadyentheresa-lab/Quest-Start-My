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
import onboardingRouter from "./onboarding";
import exportRouter from "./export";
import { billingPublicRouter, billingAuthedRouter } from "./billing";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

// Public routes (no auth)
router.use(healthRouter);
router.use(billingPublicRouter);

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
router.use(onboardingRouter);
router.use(exportRouter);
router.use(billingAuthedRouter);

export default router;
