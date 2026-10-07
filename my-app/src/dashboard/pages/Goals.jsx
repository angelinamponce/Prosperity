import { ArrowRightOutlined, CheckCircleFilled, ExclamationCircleFilled } from "@ant-design/icons";
import { Badge, Button, Card, Ring, money, pct } from "../../design";
import { addMonths, goalStatus } from "../finance";
import { PageHeader } from "../components";
import { Explain } from "../glossary";

function GoalCard({ goal, index, go }) {
  const progress = goal.target > 0 ? Math.min(1, goal.current / goal.target) : 1;
  return (
    <Card className="span-6 ps-enter" hover style={{ "--i": index }}>
      <div className="db-goal">
        <Ring value={progress} size={96} stroke={8} label={`${pct(progress)} complete`}>
          <span className="ps-num" style={{ fontWeight: 600, fontSize: 18 }}>{pct(progress)}</span>
        </Ring>
        <div className="db-goal__body">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
            <h2 className="ps-h3">{goal.term ? <Explain k={goal.term}>{goal.name}</Explain> : goal.name}</h2>
            {goal.onTrack == null ? (
              <Badge>Long-term</Badge>
            ) : goal.onTrack ? (
              <Badge tone="positive" icon={<CheckCircleFilled />}>On track</Badge>
            ) : (
              <Badge tone="warning" icon={<ExclamationCircleFilled />}>Needs a little love</Badge>
            )}
          </div>
          <p className="ps-body">
            <strong className="ps-num" style={{ color: "var(--ps-ink)" }}>{money(goal.current)}</strong> of {money(goal.target)}
          </p>
          <div className="db-goal__meta ps-small">{goal.meta.map((t) => <span key={t}>{t}</span>)}</div>
          {goal.advice && <p className="ps-small" style={{ color: "var(--ps-ink-2)" }}>{goal.advice}</p>}
          <div>
            <Button variant="ghost" size="sm" iconRight={<ArrowRightOutlined />} onClick={() => go(goal.page)} style={{ marginLeft: -12 }}>
              {goal.cta}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function Goals({ profile, metrics: m, plan, go }) {
  const now = new Date();
  const { emergency, house: houseStatus, match } = goalStatus(profile, m, now);
  const efMonthly = emergency.monthly;
  const efLeft = emergency.monthsLeft;
  const { contributionRate, matchUpTo } = match;

  const goals = [
    {
      key: "ef",
      term: "emergencyFund",
      name: "Emergency fund",
      current: m.emergencyBalance,
      target: m.emergencyTarget,
      onTrack: Number.isFinite(efLeft),
      meta: [`${money(efMonthly)}/mo`, `Done by ${addMonths(now, efLeft)}`],
      advice: `Six months of essentials (${money(m.essential)}/mo) protects you from a job loss or big surprise bill.`,
      cta: "See your cash flow",
      page: "cash-flow",
    },
    // Only when the profile has a house goal (the survey doesn't ask for one yet).
    houseStatus && {
      key: "house",
      name: houseStatus.name,
      current: houseStatus.current,
      target: houseStatus.target,
      onTrack: houseStatus.onTrack,
      meta: [
        `${money(houseStatus.monthly)}/mo`,
        `Target ${addMonths(now, houseStatus.deadlineMonths)}`,
        `At this pace ${addMonths(now, houseStatus.monthsLeft)}`,
      ],
      advice: houseStatus.onTrack ? null : `To hit your date, save about ${money(houseStatus.neededMonthly)}/mo, or push the date out.`,
      cta: "Free up money for this goal",
      page: "cash-flow",
    },
    // Only when we know the employer's match.
    !profile.retirement.unknown && match.target > 0 && {
      key: "match",
      term: "match",
      name: "Full 401(k) match",
      current: match.current,
      target: match.target,
      onTrack: contributionRate >= matchUpTo,
      meta: [`You: ${pct(contributionRate)} of salary`, `Match: up to ${pct(matchUpTo)}`],
      advice: m.matchMissedAnnual > 0 ? `You're leaving ${money(m.matchMissedAnnual)} a year of employer money unclaimed.` : null,
      cta: "Compare investing options",
      page: "invest",
    },
    {
      key: "fi",
      term: "fi",
      name: `Financial independence by ${plan.retireAge}`,
      current: m.invested,
      target: m.fiNumber,
      onTrack: null,
      meta: [`${money(plan.monthlyInvest)}/mo invested`, "Long-term goal"],
      advice: "This one takes decades. The Future page shows your odds of getting there.",
      cta: "See your range of outcomes",
      page: "future",
    },
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        eyebrow="Goals"
        title="Your goals"
        description="Each goal grows a little every month from your surplus. Here's how far you've come and when you'll get there."
        action={<Button iconRight={<ArrowRightOutlined />} onClick={() => go("cash-flow")}>Find more for your goals</Button>}
      />
      <div className="db-grid">
        {goals.map((g, i) => (
          <GoalCard key={g.key} goal={g} index={i} go={go} />
        ))}
      </div>
    </>
  );
}
