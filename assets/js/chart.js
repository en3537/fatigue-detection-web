const MAX_POINTS = 50;

let earChart = null;
let marChart = null;

let pauseCount = 0;
let globalFrame = 0;

const pauseLinePlugin = {
  id: "pauseLine",

  afterDraw(chart) {
    const pauseLines = chart.$pauseLines;

    if (!pauseLines || pauseLines.length === 0) {
      return;
    }

    const { ctx, chartArea, scales } = chart;
    const xScale = scales.x;

    if (!xScale || !chartArea) {
      return;
    }

    ctx.save();

    pauseLines.forEach((line) => {
      const x = xScale.getPixelForValue(line.frame);

      if (!Number.isFinite(x) || x < chartArea.left || x > chartArea.right) {
        return;
      }

      ctx.beginPath();
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);

      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ff3b30";

      ctx.stroke();
    });

    ctx.restore();
  },
};

Chart.register(pauseLinePlugin);

function createRealtimeChart(canvasId, label, borderColor) {
  const canvas = document.getElementById(canvasId);

  if (!canvas) {
    console.error(`Canvas not found: ${canvasId}`);
    return null;
  }

  const ctx = canvas.getContext("2d");

  const chart = new Chart(ctx, {
    type: "line",

    data: {
      datasets: [
        {
          label: label,
          data: [],

          borderColor: borderColor,
          backgroundColor: borderColor,

          borderWidth: 2,

          pointRadius: 0,
          pointHoverRadius: 0,

          tension: 0.3,

          fill: false,
        },
      ],
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      devicePixelRatio: 1,
      resizeDelay: 200,
      events: [],
      layout: {
        padding: 0,
      },

      scales: {
        x: {
          type: "linear",
          display: false,
          border: {
            display: false,
          },
          grid: {
            display: false,
          },
          min: 0,
          max: MAX_POINTS - 1,
        },

        y: {
          beginAtZero: true,
          border: {
            display: false,
          },
          ticks: {
            color: "#ffffff99",
            maxTicksLimit: 4,
            padding: 4,
          },
          grid: {
            color: "#ffffff1a",
          },
        },
      },

      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          enabled: false,
        },
      },
    },
  });

  chart.$pauseLines = [];

  return chart;
}

function initRealtimeCharts() {
  earChart = createRealtimeChart("ear-chart", "EAR", "#4ade80");
  marChart = createRealtimeChart("mar-chart", "MAR", "#60a5fa");
}

function pushChartData(chart, value, frame) {
  if (!chart) {
    return;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return;
  }

  const data = chart.data.datasets[0].data;

  data.push({
    x: frame,
    y: numericValue,
  });

  if (data.length > MAX_POINTS) {
    data.shift();
  }

  updateChartRange(chart);
}

function updateChartRange(chart) {
  if (!chart) {
    return;
  }

  const data = chart.data.datasets[0].data;

  if (data.length === 0) {
    chart.options.scales.x.min = 0;
    chart.options.scales.x.max = MAX_POINTS - 1;
    return;
  }

  const firstFrame = data[0].x;
  const lastFrame = data[data.length - 1].x;

  chart.options.scales.x.min = firstFrame;

  chart.options.scales.x.max = Math.max(lastFrame, firstFrame + 1);
}

function updateRealtimeCharts(ear, mar) {
  const hasEar =
    earChart &&
    ear !== null &&
    ear !== undefined &&
    Number.isFinite(Number(ear));

  const hasMar =
    marChart &&
    mar !== null &&
    mar !== undefined &&
    Number.isFinite(Number(mar));

  if (!hasEar && !hasMar) {
    return;
  }

  globalFrame++;

  if (hasEar) {
    pushChartData(earChart, ear, globalFrame);
  }

  if (hasMar) {
    pushChartData(marChart, mar, globalFrame);
  }

  requestAnimationFrame(() => {
    if (hasEar && earChart) {
      try {
        earChart.update("none");
      } catch (error) {
        console.error("EAR chart update error:", error);
      }
    }

    if (hasMar && marChart) {
      try {
        marChart.update("none");
      } catch (error) {
        console.error("MAR chart update error:", error);
      }
    }
  });
}

function addPauseLine() {
  if (!earChart || !marChart) {
    return;
  }

  const earData = earChart.data.datasets[0].data;
  const marData = marChart.data.datasets[0].data;

  if (earData.length === 0 && marData.length === 0) {
    return;
  }

  pauseCount++;

  const earLastFrame =
    earData.length > 0 ? earData[earData.length - 1].x : null;

  const marLastFrame =
    marData.length > 0 ? marData[marData.length - 1].x : null;

  console.log("Pause Line:", {
    pauseCount,
    earLastFrame,
    marLastFrame,
  });

  if (earLastFrame !== null) {
    earChart.$pauseLines.push({
      frame: earLastFrame,
      type: "pause",
      id: pauseCount,
    });
  }

  if (marLastFrame !== null) {
    marChart.$pauseLines.push({
      frame: marLastFrame,
      type: "pause",
      id: pauseCount,
    });
  }

  requestAnimationFrame(() => {
    if (earChart) {
      earChart.update("none");
    }

    if (marChart) {
      marChart.update("none");
    }
  });
}

function recordStopEvent() {
  console.log("Stop Event:", {
    lastFrame: globalFrame,
    pauseFrame: globalFrame + 1,
    pauseCount,
    timestamp: Date.now(),
  });
}

function resetCharts() {
  if (earChart) {
    earChart.data.datasets[0].data.length = 0;

    earChart.$pauseLines = [];

    earChart.options.scales.x.min = 0;
    earChart.options.scales.x.max = MAX_POINTS - 1;

    earChart.update("none");
  }

  if (marChart) {
    marChart.data.datasets[0].data.length = 0;

    marChart.$pauseLines = [];

    marChart.options.scales.x.min = 0;
    marChart.options.scales.x.max = MAX_POINTS - 1;

    marChart.update("none");
  }

  globalFrame = 0;
  pauseCount = 0;
}

document.addEventListener("DOMContentLoaded", initRealtimeCharts);
