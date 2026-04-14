const dashboardData = {
  metrics: [
    { label: "Lead time", value: "2.8 days", trend: "Down 14% from last sprint" },
    { label: "Deployments", value: "22", trend: "Above weekly target" },
    { label: "MTTR", value: "46 min", trend: "Stable over 30 days" },
    { label: "Sprint completion", value: "91%", trend: "1 squad at risk" }
  ],
  deployments: [
    { week: "W10", total: 12 },
    { week: "W11", total: 16 },
    { week: "W12", total: 19 },
    { week: "W13", total: 17 },
    { week: "W14", total: 21 },
    { week: "W15", total: 22 }
  ],
  incidents: [
    {
      title: "Checkout latency spike",
      severity: "Sev-2",
      severityClass: "sev2",
      summary: "Elevated p95 latency in the payments path after the most recent API gateway change.",
      owner: "Platform",
      updated: "8 min ago"
    },
    {
      title: "Build queue saturation",
      severity: "Sev-3",
      severityClass: "sev3",
      summary: "Self-hosted runners are backlogged during the EU morning overlap, increasing cycle time.",
      owner: "Developer Experience",
      updated: "21 min ago"
    },
    {
      title: "Search index drift",
      severity: "Sev-3",
      severityClass: "sev3",
      summary: "Catalog updates are landing out of order in one region. Rollback path verified.",
      owner: "Search",
      updated: "42 min ago"
    }
  ],
  squads: [
    {
      name: "Platform",
      goal: "Runtime cost reduction",
      cycle: "11.4 hrs",
      defects: "1",
      status: "Healthy",
      statusClass: "healthy"
    },
    {
      name: "Growth",
      goal: "Experiment delivery",
      cycle: "16.2 hrs",
      defects: "3",
      status: "Attention",
      statusClass: "attention"
    },
    {
      name: "Core Product",
      goal: "Workflow reliability",
      cycle: "13.1 hrs",
      defects: "0",
      status: "Healthy",
      statusClass: "healthy"
    },
    {
      name: "Developer Experience",
      goal: "CI performance",
      cycle: "18.8 hrs",
      defects: "2",
      status: "Attention",
      statusClass: "attention"
    }
  ],
  risks: [
    {
      title: "Single-threaded release approval",
      detail: "Friday releases still depend on one staff engineer for final signoff. This is creating avoidable wait states.",
      owner: "Eng leadership",
      horizon: "This sprint"
    },
    {
      title: "Flaky end-to-end suite",
      detail: "Authentication and billing tests are consuming 19% of rerun volume and obscuring real failures.",
      owner: "QA platform",
      horizon: "Next 2 weeks"
    },
    {
      title: "Observability coverage gap",
      detail: "New event-driven services have logs but incomplete traces, making cross-service incident triage slower.",
      owner: "Platform",
      horizon: "Quarter"
    }
  ]
};

function renderMetrics() {
  const container = document.querySelector("#stats-grid");

  container.innerHTML = dashboardData.metrics
    .map(
      (metric) => `
        <article class="metric">
          <p class="metric-label">${metric.label}</p>
          <p class="metric-value">${metric.value}</p>
          <p class="metric-trend">${metric.trend}</p>
        </article>
      `
    )
    .join("");
}

function renderDeployments() {
  const container = document.querySelector("#deployments-chart");
  const max = Math.max(...dashboardData.deployments.map((item) => item.total));

  container.innerHTML = dashboardData.deployments
    .map((item) => {
      const height = Math.max((item.total / max) * 210, 16);
      return `
        <div class="bar-group">
          <div class="bar" style="height: ${height}px" title="${item.total} deployments"></div>
          <strong>${item.total}</strong>
          <span>${item.week}</span>
        </div>
      `;
    })
    .join("");
}

function renderIncidents() {
  const container = document.querySelector("#incident-feed");

  container.innerHTML = dashboardData.incidents
    .map(
      (incident) => `
        <article class="feed-item">
          <header>
            <div>
              <h3>${incident.title}</h3>
            </div>
            <span class="severity ${incident.severityClass}">${incident.severity}</span>
          </header>
          <p>${incident.summary}</p>
          <div class="feed-meta">
            <span>${incident.owner}</span>
            <span>${incident.updated}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function renderSquads() {
  const container = document.querySelector("#squad-table");

  container.innerHTML = dashboardData.squads
    .map(
      (squad) => `
        <tr>
          <td>${squad.name}</td>
          <td>${squad.goal}</td>
          <td>${squad.cycle}</td>
          <td>${squad.defects}</td>
          <td><span class="status-chip ${squad.statusClass}">${squad.status}</span></td>
        </tr>
      `
    )
    .join("");
}

function renderRisks() {
  const container = document.querySelector("#risk-list");

  container.innerHTML = dashboardData.risks
    .map(
      (risk) => `
        <article class="risk-item">
          <header>
            <h3>${risk.title}</h3>
            <span class="pill">${risk.horizon}</span>
          </header>
          <p>${risk.detail}</p>
          <div class="risk-meta">
            <span>${risk.owner}</span>
            <span>Mitigation pending</span>
          </div>
        </article>
      `
    )
    .join("");
}

renderMetrics();
renderDeployments();
renderIncidents();
renderSquads();
renderRisks();
