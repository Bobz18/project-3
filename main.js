const width = 900;
const height = 520;
const margin = { top: 40, right: 160, bottom: 60, left: 70 };

const svg = d3.select("#chart")
  .append("svg")
  .attr("viewBox", `0 0 ${width} ${height}`);

const colors = {
  ssp126: "green",
  ssp245: "blue",
  ssp585: "red"
};

const tooltip = d3.select("body")
  .append("div")
  .attr("class", "tooltip")
  .style("display", "none");

d3.csv("climate_warming_d3.csv", d3.autoType).then(data => {
  const scenarios = ["ssp126", "ssp245", "ssp585"];

  const x = d3.scaleLinear()
    .domain(d3.extent(data, d => d.year))
    .range([margin.left, width - margin.right]);

  const y = d3.scaleLinear()
    .domain([
      d3.min(data, d => d.low),
      d3.max(data, d => d.high)
    ])
    .nice()
    .range([height - margin.bottom, margin.top]);

  const xAxis = svg.append("g")
    .attr("transform", `translate(0, ${height - margin.bottom})`);

  svg.append("g")
    .attr("transform", `translate(${margin.left}, 0)`)
    .call(d3.axisLeft(y));

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height - 15)
    .attr("text-anchor", "middle")
    .text("Year");

  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .text("Temperature Warming Since 2015 (°C)");

  const line = d3.line()
    .x(d => x(d.year))
    .y(d => y(d.mean));

  const area = d3.area()
    .x(d => x(d.year))
    .y0(d => y(d.low))
    .y1(d => y(d.high));

  function updateChart() {
    const selectedScenarios = Array.from(
      document.querySelectorAll(".controls input[type='checkbox']:not(#range-toggle):checked")
    ).map(d => d.value);

    const showRange = document.querySelector("#range-toggle").checked;

    const selectedYear = +document.querySelector("#year-slider").value;
    document.querySelector("#year-label").textContent = selectedYear;

    const filteredData = data.filter(d =>
      selectedScenarios.includes(d.scenario) &&
      d.year <= selectedYear
    );

    x.domain([2015, selectedYear]);
    xAxis.call(d3.axisBottom(x).tickFormat(d3.format("d")));

    svg.selectAll(".range-area")
      .data(showRange ? selectedScenarios : [], d => d)
      .join(
        enter => enter.append("path")
          .attr("class", "range-area"),
        update => update,
        exit => exit.remove()
      )
      .attr("fill", d => colors[d])
      .attr("d", scenario => {
        const scenarioData = filteredData
          .filter(d => d.scenario === scenario)
          .sort((a, b) => d3.ascending(a.year, b.year));

        return area(scenarioData);
      });

    svg.selectAll(".range-area").lower();
    
    svg.selectAll(".scenario-line")
      .data(selectedScenarios, d => d)
      .join(
        enter => enter.append("path")
          .attr("class", "scenario-line"),
        update => update,
        exit => exit.remove()
      )
      .attr("stroke", d => colors[d])
      .attr("d", scenario => {
        const scenarioData = filteredData
          .filter(d => d.scenario === scenario)
          .sort((a, b) => d3.ascending(a.year, b.year));

        return line(scenarioData);
      });

    svg.selectAll(".point")
      .data(filteredData, d => d.scenario + "-" + d.year)
      .join(
        enter => enter.append("circle")
          .attr("class", "point")
          .attr("r", 4)
          .on("mouseover", function(event, d) {
            tooltip
              .style("display", "block")
              .html(
                `<strong>${d.scenario.toUpperCase()}</strong><br>
                 Year: ${d.year}<br>
                 Mean: ${d.mean.toFixed(2)} °C<br>
                 Range: ${d.low.toFixed(2)}–${d.high.toFixed(2)} °C`
              );
          })
          .on("mousemove", function(event) {
            tooltip
              .style("left", event.pageX + 12 + "px")
              .style("top", event.pageY - 20 + "px");
          })
          .on("mouseout", function() {
            tooltip.style("display", "none");
          }),
        update => update,
        exit => exit.remove()
      )
      .attr("cx", d => x(d.year))
      .attr("cy", d => y(d.mean))
      .attr("fill", d => colors[d.scenario]);

    const legend = svg.selectAll(".legend")
      .data(scenarios)
      .join("g")
      .attr("class", "legend")
      .attr("transform", (d, i) =>
        `translate(${width - margin.right + 30}, ${margin.top + i * 25})`
      );

    legend.selectAll("rect")
      .data(d => [d])
      .join("rect")
      .attr("width", 14)
      .attr("height", 14)
      .attr("fill", d => colors[d]);

    legend.selectAll("text")
      .data(d => [d])
      .join("text")
      .attr("x", 22)
      .attr("y", 12)
      .text(d => d.toUpperCase());
  }

  document.querySelectorAll("input[type='checkbox']")
    .forEach(input => input.addEventListener("change", updateChart));

  document.querySelector("#year-slider")
    .addEventListener("input", updateChart);

  updateChart();
});