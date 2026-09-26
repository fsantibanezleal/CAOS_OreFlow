# 02 Crushing

## Theory

Whiten's crusher model treats the crushing chamber as a classification step followed by breakage,
with broken material returned to the classifier until it escapes. For a feed vector $f$ by size
class, the product is

$$p = (I - C)(I - B\,C)^{-1} f,$$

where $C$ is a diagonal matrix of the probability that a particle enters the breakage zone and $B$ is
the lower-triangular breakage matrix. The classification function is

$$C(x) = \begin{cases} 0 & x < K_1 \\ 1 - \left(\dfrac{K_2 - x}{K_2 - K_1}\right)^{K_3} & K_1 \le x \le K_2 \\ 1 & x > K_2 \end{cases}$$

$K_1$ is the size below which nothing is broken, $K_2$ the size above which everything is broken and
$K_3$ the shape (about 2 to 2.3). Industrial calibrations report $K_1$ of about 0.5 to 0.95 times the
closed-side setting (CSS) and $K_2$ of about 1.7 to 3.5 CSS.

Sources: the Andersen-Whiten form reproduced in Andrejev et al. (2021), *Calibration and validation of
a cone crusher model with industrial data*, Minerals 11(11):1256, doi:10.3390/min11111256; the HP500
fit-for-purpose study, Minerals 14(9):919 (2024), doi:10.3390/min14090919; SysCAD *Crusher 2 model
theory*; Napier-Munn, Morrell, Morrison and Kojovic (1996), *Mineral Comminution Circuits*, JKMRC,
chapter 6.

## Implementation

`comminution.crush` solves $(I - B\,C)\,y = f$ (a lower-triangular system with unit diagonal, because
$B$ has no diagonal) and returns $p = (I - C)\,y$. $B$ comes from the cumulative Austin breakage
function of page 03 with crusher parameters. The crusher runs in open circuit on the bulk ore; every
mineral shares the bulk distribution in the crusher feed, a Rosin-Rammler curve with the case
crusher-feed F80.

## Parameters

| Parameter | Value | Unit | Source |
|---|---|---|---|
| $K_1$ | 0.8 CSS | um | inside the reported 0.5 to 0.95 CSS |
| $K_2$ | 2.3 CSS | um | inside the reported 1.7 to 3.5 CSS |
| $K_3$ | 2.3 | 1 | commonly used value |
| breakage $\beta_0, \beta_1, \beta_2$ | 0.4, 0.7, 3.5 | 1 | authored; Austin form |
| crusher feed F80, slope | 60 mm, 0.9 | um, 1 | authored secondary-crusher feed |
| CSS | 8 mm (control) | mm | operating control, bounds in Contract 1 |

Crushing energy is reported with Bond's equation and the case crushing work index (page 09).

## Verification

`tests/test_crusher.py::test_whiten_form_mass_and_css_response` (PE-04): the breakage columns sum to
one; mass is conserved to 1e-12; classes below $K_1$ are never broken, so their product is at least
their feed; product P80 falls monotonically as CSS closes.

## What it is not

The $K$ values do not respond to throughput, feed size or liner wear as the plant regressions do, and
crusher power is not modelled; the crusher only sets the ball-mill feed and the crushing energy.
