/*
    GENERATIVE PORTFOLIO
    --------------------

    Inspired by:
    - L-systems
    - recursive trees
    - symmetry
    - organic growth

    Interaction:
    - Mouse controls growth direction
    - Scroll controls growth amount
    - Canvas automatically adapts to screen size
*/


let branches = [];

let canvas;

let growth = 0;

let scrollAmount = 0;

let targetGrowth = 0;

let lastScroll = 0;


/* COLOURS */

const COLORS = {
  green: [159, 197, 90],
  purple: [156, 99, 163],
  yellow: [212, 196, 91],
  red: [217, 75, 104],
  white: [243, 241, 237]
};


/* SETUP */

function setup() {

  canvas = createCanvas(windowWidth, windowHeight);

  canvas.parent("canvas-container");

  angleMode(DEGREES);

  colorMode(RGB);

  background(64, 61, 63);

  generateSystem();

}


/* CREATE INITIAL STRUCTURE */

function generateSystem() {

  branches = [];

  /*
      Create several seeds.

      These become the roots of our
      recursive structures.
  */

  branches.push(
    new Branch(
      width * 0.88,
      height * 0.9,
      90,
      -25,
      0,
      COLORS.green
    )
  );


  branches.push(
    new Branch(
      width * 0.12,
      height * 0.25,
      75,
      35,
      0,
      COLORS.purple
    )
  );


  branches.push(
    new Branch(
      width * 0.75,
      height * 0.25,
      65,
      -20,
      0,
      COLORS.yellow
    )
  );


  branches.push(
    new Branch(
      width * 0.2,
      height * 0.85,
      55,
      15,
      0,
      COLORS.red
    )
  );

}


/* DRAW */

function draw() {

  /*
      Instead of clearing completely,
      draw a translucent background.

      This creates subtle trails.
  */

  background(64, 61, 63, 45);


  /*
      Smoothly interpolate growth.

      This prevents sudden movement.
  */

  growth = lerp(
    growth,
    targetGrowth,
    0.04
  );


  /*
      Draw each recursive structure.
  */

  for (let branch of branches) {

    branch.render();

  }


  /*
      Small central geometric system.
  */

  drawGeometry();


  /*
      Update target growth using scroll.
  */

  let maxScroll =
    document.body.scrollHeight - window.innerHeight;

  if (maxScroll > 0) {

    let scrollProgress =
      constrain(
        window.scrollY / maxScroll,
        0,
        1
      );

    targetGrowth =
      map(
        scrollProgress,
        0,
        1,
        0,
        35
      );

  }

}


/* RECURSIVE BRANCH CLASS */

class Branch {

  constructor(
    x,
    y,
    length,
    angle,
    depth,
    colour
  ) {

    this.x = x;

    this.y = y;

    this.length = length;

    this.angle = angle;

    this.depth = depth;

    this.colour = colour;

  }


  render() {

    push();

    translate(
      this.x,
      this.y
    );

    rotate(this.angle);

    this.drawBranch(
      this.length,
      this.depth
    );

    pop();

  }


  drawBranch(len, depth) {

    /*
        Stop recursion when the branch
        becomes very small.
    */

    if (len < 4 || depth > 7) {

      return;

    }


    /*
        Mouse interaction.

        Mouse position influences
        branching direction.
    */

    let mouseInfluence =
      map(
        mouseX,
        0,
        width,
        -20,
        20
      );


    /*
        Scroll adds growth.
    */

    let animatedLength =
      len + growth * (1 - depth / 10);


    /*
        Branch colour.

        Older branches are more transparent.
    */

    let alpha =
      map(
        depth,
        0,
        7,
        130,
        35
      );


    stroke(
      this.colour[0],
      this.colour[1],
      this.colour[2],
      alpha
    );

    strokeWeight(
      map(
        depth,
        0,
        7,
        2.5,
        0.5
      )
    );

    line(
      0,
      0,
      0,
      -animatedLength
    );


    translate(
      0,
      -animatedLength
    );


    /*
        Organic movement.

        Noise creates slower,
        less mechanical movement.
    */

    let movement =
      map(
        noise(
          frameCount * 0.005 +
          depth
        ),
        0,
        1,
        -10,
        10
      );


    /*
        LEFT BRANCH
    */

    push();

    rotate(
      -25 +
      mouseInfluence * 0.3 +
      movement
    );

    this.drawBranch(
      animatedLength * 0.72,
      depth + 1
    );

    pop();


    /*
        RIGHT BRANCH
    */

    push();

    rotate(
      25 +
      mouseInfluence * 0.3 -
      movement
    );

    this.drawBranch(
      animatedLength * 0.72,
      depth + 1
    );

    pop();

  }

}


/* GEOMETRIC RECURSION */

function drawGeometry() {

  push();

  translate(
    width / 2,
    height / 2
  );


  /*
      Slow rotation.
  */

  rotate(
    frameCount * 0.01
  );


  noFill();


  /*
      Mouse controls scale.
  */

  let distance =
    dist(
      mouseX,
      mouseY,
      width / 2,
      height / 2
    );


  let scaleAmount =
    map(
      distance,
      0,
      width,
      0.3,
      1.2
    );


  scale(scaleAmount);


  /*
      Draw recursive circles.
  */

  for (
    let i = 0;
    i < 8;
    i++
  ) {

    let size =
      50 + i * 35 + growth;

    stroke(
      COLORS.white[0],
      COLORS.white[1],
      COLORS.white[2],
      18
    );

    ellipse(
      0,
      0,
      size,
      size
    );

  }


  /*
      Triangle system.
  */

  rotate(
    frameCount * 0.02
  );


  for (
    let i = 0;
    i < 6;
    i++
  ) {

    rotate(60);

    stroke(
      COLORS.yellow[0],
      COLORS.yellow[1],
      COLORS.yellow[2],
      25
    );

    triangle(
      0,
      -120 - growth,
      -55,
      30,
      55,
      30
    );

  }

  pop();

}


/* WINDOW RESIZE */

function windowResized() {

  resizeCanvas(
    windowWidth,
    windowHeight
  );

  generateSystem();

}


/*
    MOUSE INTERACTION

    When the mouse moves,
    the system subtly regenerates.
*/

function mouseMoved() {

  if (
    abs(mouseX - pmouseX) > 20 ||
    abs(mouseY - pmouseY) > 20
  ) {

    targetGrowth += 0.5;

    targetGrowth =
      constrain(
        targetGrowth,
        0,
        50
      );

  }

}


/*
    MOBILE SUPPORT

    Touch position influences the
    generative system.
*/

function touchMoved() {

  if (touches.length > 0) {

    mouseX = touches[0].x;

    mouseY = touches[0].y;

  }

}