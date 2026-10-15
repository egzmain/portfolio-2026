
// global space
var algaeEater_1;  // plancton eater no.1
var algaeEater_2;  // plancton eater no.2
var plancton;  // plancton - fish's food

var fishStock =[]; //  an empty array to hold a fish stock 

function setup() {
  
  createCanvas(400, 800); // square shape of a canvas that resembles the aquarium seen from the above
  
  // itterating an even number of times to create a fish stock that will beign to render at the left top part of the screen; pushing new 
  for ( var i=0; i<100; i++)
  {
      var x1= random(0,width/2);
      var y1=random(0,height/2)
      fishStock.push(new Fish(x1,y1));
  }
  
  plancton=[]; // plancton array
  
  // creating two plancton eaters, as per literal variables
  algaeEater_1= new AlgaeEater(100,100);
  algaeEater_2= new AlgaeEater(-1500,-1500);
  
  // creating 100X plancton and 100X fish
  for(var j = 0; j < 100; j++)
  {
  var x2= random(0,width/2);
  var y2=random(0,height/2)
   plancton.push(createVector(random(0,width),random(0,height)));  
   fishStock.push(new Fish(x2,y2));
  }
  
}

function draw() {
  background(20,40,100,10);
  
  push();
  for (var i=0; i<fishStock.length; i++) 
  {
    fishStock[i].edges();
    fishStock[i].stock(fishStock);
    fishStock[i].update();
    fishStock[i].show(i); // passing an i as the argument to define the colour within the show method, as i incerements from 0 to fishStock.length, this will results palette of different colours
  }
  pop();
  
  push();
   for (var j=0; j<fishStock.length; j++) 
 {
    fishStock[j].edges();
    fishStock[j].stock(fishStock);
    fishStock[j].update();
    fishStock[j].show(j);
  }
  pop();
 
  // for loop to display a plancton of elliptic shape and random shades of blue
  for(var k = 0; k < plancton.length; k++)
  {
      fill(random(0,10),random(10,255),random(200,220),20);
      noStroke();
      ellipse(plancton[k].x,plancton[k].y,random(0,10));
   }
  
  algaeEater_1.edges();  // call method edges on fish object to ensure that fish remain on the screen
  algaeEater_1.eat(plancton);// call method eat on fish object, passing trough plancton array to ensure fish is clearing the surface of aquariam covered with plancton
  algaeEater_1.update(); // update the state of fish
  algaeEater_1.show(200);// display fish on screen
  
  algaeEater_2.edges();  // call method edges on fish object to ensure that fish remain on the screen
  algaeEater_2.eat(plancton);// call method eat on fish object, passing trough plancton array to ensure fish is clearing the surface of aquariam covered with plancton
  algaeEater_2.update(); // update the state of fish
  algaeEater_2.show(100);// display fish on screen
  
}

/* AUTONOMUS AGENTS, TITLE:"SEALIFE", File: sketch.js + sealife.js  DESCRIPTION: 

I have created a flocking system that is based on the flocking algorithm by Craig Reynolds. The flocking system represents the stock of the living fish in the aquarium. Considering this piece is rendered within 2 dimensions, the movement of the fish within the water is assumed to be represented from the above perspective. As per Reynold's algorithm, the flocking system is based on the 3 rules: separation - avoiding crowds, alignment - steering towards the average velocity of local fish and cohesion -steering towards the average position of the local fish. 

The object created with the AlgaeEater constructor within my programme represents a fish that lives separated from the stock and makes its living eating the plancton - the ellipses reflecting with shades of green-ish. The AlgaeEater is supported by the eat method that makes use of the "seek" behaviour created by Craig Reynolds. This algorithm is based on the steering force that according to Reynold is an equivalent of the desired velocity minus agents velocity. 

During the work on this piece, I was predominantly focused on the visual effect rather than the achievement of more complex behaviour.  My inspiration comes from the generative art of Cao Yuxi, which I discovered during the LUX exhibition in 2021. Although the Yuxi uses the different techniques within their process, I was encouraged to use an autonomous agent to achieve a similar Brownian-motion like behaviour, casting the patterns that resemble flow fields. Considering the limitations of the p5js within the render of the graphics, the achieved effects are away from the quality of Yuxi particle systems, still satisfying. 

The work on this piece I have found the most challenging. As the starting point, I have used the template that I have created based on tutorials by Daniel Shiffman. Please see the details attached below for reference. I have coded along with the tutorials and refactored the code for this project. 

I shall continue to work on this project to develop it further, so the piece can change over time and lasts engaging for longer. I look forward to expanding the coding skills that will allow me to programme my autonomous systems. 

*/