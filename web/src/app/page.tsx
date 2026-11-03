
"use client";

import { useEffect, useState, type FormEvent } from "react";

type Task = {
  id: string;
  input: string;
  taskType: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type TaskStep = {
  id: string;
  planId: string;
  position: number;
  title: string;
  description: string;
  stepType: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type TaskPlan = {
  id: string;
  taskId: string;
  version: number;
  summary: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  steps: TaskStep[];
};

type Notice = {
  kind: "success" | "error";
  message: string;
};

type PlanAction = "generate" | "generate-ai" | "view";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function getApiError(
  response: Response,
  fallback: string
): Promise<string> {
  const result: unknown = await response.json().catch(() => null);

  if (
    typeof result === "object" &&
    result !== null &&
    "message" in result
  ) {
    const message = result.message;

    if (typeof message === "string") return message;

    if (
      Array.isArray(message) &&
      message.every((item) => typeof item === "string")
    ) {
      return message.join(", ");
    }
  }

  return fallback;
}

function isTaskPlan(value: unknown): value is TaskPlan {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "taskId" in value &&
    "steps" in value &&
    Array.isArray(value.steps)
  );
}

export default function Home() {
  const [taskInput, setTaskInput] = useState("");
  const [taskType, setTaskType] = useState("general");

  const [notice, setNotice] = useState<Notice | null>(null);
  const [planNotice, setPlanNotice] = useState<Notice | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<TaskPlan | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [planActionTaskId, setPlanActionTaskId] = useState<string | null>(
    null
  );
  const [planActionType, setPlanActionType] =
    useState<PlanAction | null>(null);

  // Load previously saved tasks from PostgreSQL through the API.
  useEffect(() => {
    let cancelled = false;

    async function loadTasks() {
      setIsLoadingTasks(true);

      try {
        const response = await fetch(`${API_URL}/api/tasks`);

        if (!response.ok) {
          throw new Error(
            `Unable to load tasks (${response.status}).`
          );
        }

        const data: unknown = await response.json();

        if (!Array.isArray(data)) {
          throw new Error("Invalid task list returned by backend.");
        }

        if (!cancelled) {
          setTasks(data as Task[]);
          setLoadError("");
        }
      } catch {
        if (!cancelled) {
          setLoadError(
            "Could not connect to the task API. Check that NestJS is running."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingTasks(false);
        }
      }
    }

    void loadTasks();

    return () => {
      cancelled = true;
    };
  }, []);

  // Create a new task in PostgreSQL.
  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!taskInput.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setNotice(null);

    try {
      const response = await fetch(`${API_URL}/api/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: taskInput.trim(),
          taskType,
        }),
      });

      if (!response.ok) {
        throw new Error(
          await getApiError(
            response,
            `Unable to create task (${response.status}).`
          )
        );
      }

      const result: unknown = await response.json();

      if (
        typeof result !== "object" ||
        result === null ||
        !("id" in result) ||
        typeof result.id !== "string"
      ) {
        throw new Error("Invalid task response from backend.");
      }

      const createdTask = result as Task;

      setTasks((previousTasks) => [
        createdTask,
        ...previousTasks.filter(
          (item) => item.id !== createdTask.id
        ),
      ]);

      setTaskInput("");

      setNotice({
        kind: "success",
        message: `Task saved successfully! ID: ${createdTask.id}`,
      });

      setLoadError("");
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Something went wrong while creating the task.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  // Generate a new plan or retrieve the latest saved plan.
  async function handlePlanAction(
    taskId: string,
    action: PlanAction
  ) {
    if (planActionTaskId !== null) return;

    setPlanActionTaskId(taskId);
    setPlanActionType(action);
    setPlanNotice(null);

    try {
      const method = action === "view" ? "GET" : "POST";
      const endpoint = action === "generate-ai" ? "ai-plan" : "plan";

      const response = await fetch(
        `${API_URL}/api/tasks/${encodeURIComponent(taskId)}/${endpoint}`,
        { method }
      );

      if (!response.ok) {
        throw new Error(
          await getApiError(
            response,
            action === "view"
              ? "Could not retrieve the plan."
              : "Could not generate the plan."
          )
        );
      }

      const result: unknown = await response.json();

      if (!isTaskPlan(result)) {
        throw new Error("The backend returned an invalid plan.");
      }

      setSelectedPlan(result);

      if (action !== "view") {
        setTasks((previousTasks) =>
          previousTasks.map((item) =>
            item.id === taskId
              ? { ...item, status: "planned" }
              : item
          )
        );

        setPlanNotice({
          kind: "success",
          message:
            action === "generate-ai"
              ? `AI-generated plan version ${result.version} was saved successfully.`
              : `Rule-based plan version ${result.version} was saved successfully.`,
        });
      } else {
        setPlanNotice({
          kind: "success",
          message: `Plan version ${result.version} retrieved successfully.`,
        });
      }

      setTimeout(() => {
        document
          .getElementById("selected-plan")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (error) {
      setPlanNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Something went wrong while processing the plan.",
      });
    } finally {
      setPlanActionTaskId(null);
      setPlanActionType(null);
    }
  }

  function handleNewTask() {
    setTaskInput("");
    setNotice(null);

    document.getElementById("task")?.focus();
  }

  function closePlan() {
    setSelectedPlan(null);
    setPlanNotice(null);
  }

  const completedSteps =
    selectedPlan?.steps.filter(
      (step) => step.status === "completed"
    ).length ?? 0;

  const totalSteps = selectedPlan?.steps.length ?? 0;

  return (
    <main className="min-h-screen bg-[#090b10] text-slate-100">
      <div className="flex min-h-screen">

        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-white/10 bg-[#0d1017] p-5 md:flex">

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-xl font-bold text-violet-300 ring-1 ring-violet-400/30">
              O
            </div>

            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                OmniMind
              </h1>
              <p className="text-xs text-slate-500">
                AI workspace
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleNewTask}
            className="mt-10 flex items-center gap-3 rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-400"
          >
            <span className="text-lg">+</span>
            New task
          </button>

          <p className="mb-3 mt-9 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Workspace
          </p>

          <nav className="space-y-1">
            <div className="flex items-center gap-3 rounded-lg bg-white/[0.07] px-3 py-3 text-sm text-white">
              <span>⌂</span>
              Overview
            </div>

            <button
              type="button"
              onClick={() =>
                document
                  .getElementById("recent-tasks")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-slate-400 transition hover:bg-white/[0.04] hover:text-white"
            >
              <span>◷</span>
              Task history
            </button>

            <div className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-slate-400">
              <span>◇</span>
              Capabilities
            </div>

            <div className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-slate-400">
              <span>⚙</span>
              Settings
            </div>
          </nav>

          <div className="mt-auto rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="text-xs font-medium text-slate-300">
                Development mode
              </span>
            </div>

            <p className="mt-2 text-xs leading-5 text-slate-500">
              Task management and planning API are connected.
            </p>
          </div>
        </aside>

        {/* Main content */}
        <section className="min-w-0 flex-1">

          <header className="flex h-[72px] items-center justify-between border-b border-white/10 px-5 sm:px-8">
            <p className="text-sm text-slate-400">
              Workspace / Overview
            </p>

            <div className="flex items-center gap-3">
              <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-300">
                MVP · In progress
              </span>

              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm font-medium">
                A
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">

            {/* Hero */}
            <div className="max-w-3xl">

              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/[0.08] px-3 py-1.5 text-xs text-violet-300">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                One workspace. Multiple AI capabilities.
              </div>

              <h2 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                Turn your ideas into
                <span className="block bg-gradient-to-r from-violet-300 via-indigo-300 to-cyan-300 bg-clip-text text-transparent">
                  verified outcomes.
                </span>
              </h2>

              <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
                Describe your goal. OmniMind is designed to plan
                the work, select suitable AI capabilities, execute
                each step, and verify the result before delivery.
              </p>
            </div>

            {/* Task composer */}
            <form
              onSubmit={handleSubmit}
              className="mt-10 max-w-4xl rounded-2xl border border-white/10 bg-[#10141d] p-4 shadow-2xl shadow-black/20 sm:p-6"
            >
              <label
                htmlFor="task"
                className="mb-3 block text-sm font-medium text-slate-200"
              >
                What would you like OmniMind to accomplish?
              </label>

              <textarea
                id="task"
                value={taskInput}
                onChange={(event) => {
                  setTaskInput(event.target.value);
                  setNotice(null);
                }}
                placeholder="Example: Build a responsive portfolio website from my CV and test it..."
                rows={4}
                maxLength={10000}
                className="w-full resize-y rounded-xl border border-white/10 bg-[#090c12] p-4 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/10"
              />

              <div className="mt-4">
                <label
                  htmlFor="taskType"
                  className="mb-2 block text-sm text-slate-300"
                >
                  Task type
                </label>

                <select
                  id="taskType"
                  value={taskType}
                  onChange={(event) => setTaskType(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#090c12] p-3 text-sm text-white outline-none focus:border-violet-400/60 sm:max-w-xs"
                >
                  <option value="general">General</option>
                  <option value="website">Website</option>
                  <option value="coding">Coding</option>
                  <option value="research">Research</option>
                  <option value="image">Image</option>
                </select>
              </div>

              <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <p className="text-xs text-slate-500">
                  Free-first routing · Controlled execution · Verification
                </p>

                <button
                  type="submit"
                  disabled={!taskInput.trim() || isSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isSubmitting ? "Saving..." : "Create task"}
                  {!isSubmitting && <span>→</span>}
                </button>
              </div>

              {notice && (
                <p
                  role="status"
                  className={`mt-4 break-words rounded-lg border p-3 text-sm leading-6 ${
                    notice.kind === "success"
                      ? "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200"
                      : "border-red-400/20 bg-red-400/[0.06] text-red-200"
                  }`}
                >
                  {notice.message}
                </p>
              )}
            </form>

            {/* Recent Tasks */}
            <section id="recent-tasks" className="mt-12">

              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                <div>
                  <h3 className="text-lg font-semibold">
                    Recent tasks
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Saved tasks retrieved from your backend.
                  </p>
                </div>

                <span className="text-xs text-slate-500">
                  {isLoadingTasks
                    ? "Loading tasks..."
                    : `${tasks.length} ${
                        tasks.length === 1 ? "task" : "tasks"
                      }`}
                </span>
              </div>

              {loadError && (
                <div
                  role="alert"
                  className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm text-red-200"
                >
                  {loadError}
                </div>
              )}

              {isLoadingTasks && tasks.length === 0 ? (
                <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.025] p-6 text-sm text-slate-400">
                  Loading your saved tasks...
                </div>
              ) : tasks.length === 0 ? (
                <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.025] p-6">
                  <p className="text-sm font-medium text-slate-200">
                    No tasks to display
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Create your first task above.
                  </p>
                </div>
              ) : (
                <div className="mt-5 space-y-3">

                  {tasks.map((item) => {
                    const isBusy =
                      planActionTaskId === item.id;

                    return (
                      <article
                        key={item.id}
                        className="rounded-xl border border-white/10 bg-white/[0.025] p-4 transition hover:border-white/20 sm:p-5"
                      >
                        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">

                          <div className="min-w-0">
                            <h4 className="break-words text-sm font-medium text-white">
                              {item.input}
                            </h4>

                            <p className="mt-2 break-all text-xs text-slate-500">
                              ID: {item.id}
                            </p>

                            <p className="mt-2 text-xs text-slate-500">
                              Created:{" "}
                              {new Date(item.createdAt).toLocaleString()}
                            </p>
                          </div>

                          <div className="flex shrink-0 flex-wrap gap-2">
                            <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-xs text-violet-300">
                              {item.taskType}
                            </span>

                            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-300">
                              {item.status}
                            </span>
                          </div>
                        </div>

                        {/* Planning actions */}
                        <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">

                          <button
                            type="button"
                            disabled={planActionTaskId !== null}
                            onClick={() =>
                              void handlePlanAction(
                                item.id,
                                "generate"
                              )
                            }
                            className="rounded-lg bg-violet-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {isBusy &&
                            planActionType === "generate"
                              ? "Generating..."
                              : "Generate plan"}
                          </button>

                          <button
                            type="button"
                            disabled={planActionTaskId !== null}
                            onClick={() =>
                              void handlePlanAction(
                                item.id,
                                "generate-ai"
                              )
                            }
                            className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {isBusy && planActionType === "generate-ai"
                              ? "Generating with AI..."
                              : "Generate AI plan"}
                          </button>

                          <button
                            type="button"
                            disabled={planActionTaskId !== null}
                            onClick={() =>
                              void handlePlanAction(
                                item.id,
                                "view"
                              )
                            }
                            className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {isBusy && planActionType === "view"
                              ? "Loading..."
                              : "View plan"}
                          </button>
                        </div>

                        <p className="mt-3 text-xs leading-5 text-slate-600">
                          AI plan generation uses your configured Groq API quota and saves a new plan version each time.
                        </p>
                      </article>
                    );
                  })}

                </div>
              )}
            </section>

            {/* Plan notification */}
            {planNotice && (
              <div
                role="status"
                className={`mt-6 break-words rounded-xl border p-4 text-sm leading-6 ${
                  planNotice.kind === "success"
                    ? "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200"
                    : "border-red-400/20 bg-red-400/[0.06] text-red-200"
                }`}
              >
                {planNotice.message}
              </div>
            )}

            {/* Selected execution plan */}
            {selectedPlan && (
              <section
                id="selected-plan"
                className="mt-10 scroll-mt-8 rounded-2xl border border-violet-400/20 bg-[#10141d] p-5 sm:p-7"
              >

                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">

                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-violet-400" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-violet-300">
                        Execution plan
                      </span>
                    </div>

                    <h3 className="text-xl font-semibold">
                      Generated task plan
                    </h3>

                    <p className="mt-2 break-all text-xs text-slate-500">
                      Plan ID: {selectedPlan.id}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Task ID: {selectedPlan.taskId}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closePlan}
                    className="w-fit rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
                  >
                    Close plan ✕
                  </button>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">

                  <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                    <p className="text-xs text-slate-500">
                      Plan version
                    </p>
                    <p className="mt-2 text-xl font-semibold">
                      v{selectedPlan.version}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                    <p className="text-xs text-slate-500">
                      Total steps
                    </p>
                    <p className="mt-2 text-xl font-semibold">
                      {totalSteps}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                    <p className="text-xs text-slate-500">
                      Completed steps
                    </p>
                    <p className="mt-2 text-xl font-semibold">
                      {completedSteps}/{totalSteps}
                    </p>
                  </div>

                </div>

                <div className="mt-5 rounded-xl border border-white/10 bg-[#090c12] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Plan summary
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-300">
                    {selectedPlan.summary}
                  </p>
                </div>

                <div className="mt-7">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-semibold">
                      Execution steps
                    </h4>

                    <span className="text-xs text-slate-500">
                      {selectedPlan.steps.length} subtasks
                    </span>
                  </div>

                  {selectedPlan.steps.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-400">
                      This plan has no steps.
                    </p>
                  ) : (
                    <div className="mt-5 space-y-3">

                      {selectedPlan.steps.map((step) => (
                        <article
                          key={step.id}
                          className="rounded-xl border border-white/10 bg-white/[0.025] p-4 sm:p-5"
                        >
                          <div className="flex items-start gap-3">

                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-400/20 bg-violet-400/10 text-xs font-semibold text-violet-300">
                              {step.position}
                            </div>

                            <div className="min-w-0 flex-1">

                              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                                <h5 className="text-sm font-semibold text-white">
                                  {step.title}
                                </h5>

                                <span
                                  className={`w-fit rounded-full border px-3 py-1 text-[11px] ${
                                    step.status === "completed"
                                      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                                      : step.status === "failed"
                                        ? "border-red-400/20 bg-red-400/10 text-red-300"
                                        : "border-white/10 bg-white/[0.03] text-slate-400"
                                  }`}
                                >
                                  {step.status}
                                </span>
                              </div>

                              <p className="mt-2 text-sm leading-6 text-slate-400">
                                {step.description}
                              </p>

                              <p className="mt-3 text-xs text-slate-600">
                                Step type: {step.stepType}
                              </p>

                            </div>
                          </div>
                        </article>
                      ))}

                    </div>
                  )}
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
                  <div>
                    <p className="text-sm font-medium text-slate-300">
                      Plan status: {selectedPlan.status}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Created:{" "}
                      {new Date(selectedPlan.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-300">
                    Planning only · Execution not started
                  </span>
                </div>

              </section>
            )}

            {/* Architecture overview */}
            <div className="mt-12">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                <div>
                  <h3 className="text-lg font-semibold">
                    The OmniMind workflow
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    The system we are building, one layer at a time.
                  </p>
                </div>

                <span className="text-xs text-slate-500">
                  Architecture preview
                </span>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

                {[
                  {
                    number: "01",
                    title: "Understand",
                    description:
                      "Interpret the request and create a structured plan.",
                    color: "text-violet-300",
                  },
                  {
                    number: "02",
                    title: "Select",
                    description:
                      "Choose suitable capabilities within free-tier rules.",
                    color: "text-indigo-300",
                  },
                  {
                    number: "03",
                    title: "Execute",
                    description:
                      "Coordinate approved tools and task dependencies.",
                    color: "text-cyan-300",
                  },
                  {
                    number: "04",
                    title: "Verify",
                    description:
                      "Run checks, recover from failures, and report evidence.",
                    color: "text-emerald-300",
                  },
                ].map((step) => (
                  <article
                    key={step.number}
                    className="rounded-xl border border-white/10 bg-white/[0.025] p-5 transition hover:border-white/20 hover:bg-white/[0.04]"
                  >
                    <span
                      className={`text-xs font-semibold ${step.color}`}
                    >
                      STEP {step.number}
                    </span>

                    <h4 className="mt-4 font-semibold">
                      {step.title}
                    </h4>

                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {step.description}
                    </p>
                  </article>
                ))}

              </div>
            </div>

            {/* Current milestone */}
            <div className="mt-10 flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">
                  Current milestone: Task Planning
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Generating, saving and retrieving structured task plans.
                </p>
              </div>

              <span className="w-fit rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-300">
                Planning API connected
              </span>
            </div>

            <footer className="mt-12 border-t border-white/10 pt-5 text-xs text-slate-600">
              OmniMind AI · Built incrementally with verifiable engineering.
            </footer>

          </div>
        </section>
      </div>
    </main>
  );
}
