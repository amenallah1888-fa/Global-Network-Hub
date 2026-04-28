import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import postsRouter from "./posts";
import circlesRouter from "./circles";
import pitchesRouter from "./pitches";
import markersRouter from "./markers";
import notificationsRouter from "./notifications";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(postsRouter);
router.use(circlesRouter);
router.use(pitchesRouter);
router.use(markersRouter);
router.use(notificationsRouter);

export default router;
