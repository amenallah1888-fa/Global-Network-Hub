import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import postsRouter from "./posts";
import circlesRouter from "./circles";
import pitchesRouter from "./pitches";
import markersRouter from "./markers";
import notificationsRouter from "./notifications";
import messagesRouter from "./messages";
import pitchUpdatesRouter from "./pitch-updates";
import transactionsRouter from "./transactions";
import reportsRouter from "./reports";
import proposalsRouter from "./proposals";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(postsRouter);
router.use(circlesRouter);
router.use(pitchesRouter);
router.use(markersRouter);
router.use(notificationsRouter);
router.use(messagesRouter);
router.use(pitchUpdatesRouter);
router.use(transactionsRouter);
router.use(reportsRouter);
router.use(proposalsRouter);
router.use(aiRouter);

export default router;
