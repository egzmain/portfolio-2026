// The below code of Fish class is based on "Coding Challenge #124: Flocking Simulation", available on Coding Train youtube platform and it's author is Daniel Shiffman. This turtorial is available at the following link: https://www.youtube.com/watch?v=mhjuuHl6qHM. I have coded along the turtorial and readapted the rewritten code.*/

class Fish {
  constructor(x,y) 
  {
    this.position = createVector(x,y);
    this.velocity = p5.Vector.random2D();
    this.velocity.setMag(random(2, 4));
    this.acceleration = createVector();
    this.maxForce = 0.2;
    this.maxSpeed = 5;
  }

  /*ALLIGN function : allign this fish with the other fish within the fish stock at the given distance (perception) - the idea : steering at the other fish velocity*/
  
  align(fish) 
  {
    let perceptionRadius = 25; // variable that define the distance between this fish and the other fish within the stock
    let steering = createVector(); // creating an empty vector
    let total = 0;
    for (let other of fish) 
    {
      let d = dist(this.position.x, this.position.y, other.position.x, other.position.y);


      // conditional statement, checking if distance between this fish and the other fish is smaller than pre-defined distance (var perception), making sure this boid is being excluded from the condition
      if (other != this && d < perceptionRadius) 
      {
        steering.add(other.velocity);
        total++;
      }
    }
    // getting an average velocity of all the fish
    // dividing by a total of the fish, provided that toatl is smaller than 0
    if (total > 0) 
    {
      steering.div(total);
      steering.setMag(this.maxSpeed); // from Craig Reynolds formula for a steering force
      steering.sub(this.velocity);  //from Craig Reynolds formula for a steering force: desired velocity - this velocity
      steering.limit(this.maxForce); //limits the magitude of the vector
    }
    // return function at the end to ensure that vector is always return
    return steering;
   }
  
  //  COHESION - steer to move toward the average position of local flockmates - steering at the others position
  cohesion(fish) 
  {
    let perceptionRadius = 50;
    let steering = createVector();
    let total = 0;
    for (let other of fish) 
    {
      let d = dist(this.position.x, this.position.y, other.position.x, other.position.y);
      if (other != this && d < perceptionRadius) 
      {
        steering.add(other.position);
        total++;
      }
    }
    if (total > 0) 
    {
      steering.div(total);
      steering.sub(this.position);  // substratcing this fish position from the average psoition within given distance
      steering.setMag(this.maxSpeed); // ensuring that fish moves towards neigboughouring fish at the maximum speed
      steering.sub(this.velocity);  //from Craig Reynolds formula for a steering force: desired velocity - this velocity
      steering.limit(this.maxForce);
    }
    return steering;
  }
  
  //SEPARTION: steer away to avoid crowds of fish within the stock
  // desired velocity is opposite direction to the local fish - the magnitude of the desired velocity is propotional to the distance and it is inversely propotional to the distance of the local fish

  separation(fish) 
  {
    let perceptionRadius = 24;
    let steering = createVector();
    let total = 0;
    for (let other of fish)
    {
      let d = dist(this.position.x, this.position.y, other.position.x, other.position.y);
      
       // conditional statement, checking if distance between this fish and the other fish is smaller than pre-defined distance (var perception), making sure this boid is being excluded from the condition
      if (other != this && d < perceptionRadius) 
      {
        let diff = p5.Vector.sub(this.position, other.position);
        diff.div(d * d);
        steering.add(diff);
        total++;
      }
    }
      
    if (total > 0) 
    {
      steering.div(total);
      steering.setMag(this.maxSpeed); // ensuring that fish moves away from neigboughouring fish at the maximum speed
      steering.sub(this.velocity); //from Craig Reynolds formula for a steering force: desired velocity - this velocity
      steering.limit(this.maxForce);//limits the magitude of the vector
    }
    return steering;
  }

  stock(fish) 
  {
    //From Newton's low of motion - force is equal to a multiplication of mass and acceleration, since in p5js mass is equal to 1---> force is equal to acceleartaion
    let alignment = this.align(fish);
    let cohesion = this.cohesion(fish);
    let separation = this.separation(fish);

     // Since there is more than one force that impacts the object's accelleration, instead of assigning force ( in the instance of a singular force), forces are being add to vector acceleration
    this.acceleration.add(alignment);
    this.acceleration.add(cohesion);
    this.acceleration.add(separation);
  }
  
  // update the state of the vector
  update()
  {
    this.position.add(this.velocity); // position is being updated based on boids's velocity
    this.velocity.add(this.acceleration); // acceleration is updated based on boid's acceleration
    this.velocity.limit(this.maxSpeed); //limiting velocity by maximud speed
    this.acceleration.mult(0); // ensuring that acceleartion does not add up over the time - provided with the mulitplication by balue of 0
  }
  
  // define the parameters for display of the vector
  show(color) 
  {
    strokeWeight(color%11 +1); // using a modulo operator to get a variation of size within the fish stock; +1 to ensure every point is being drawn; Provided that within the setup I iterate an even numebr of times when creating fish stocks, this +1 operation is unnecessary. Should that change, I keep the baove settings.
    stroke(255,255%color + color,100 - color,100);// using a modulo operator for the operation to get a value that will determine the varriation of colour within the fish stocks
    point(this.position.x, this.position.y);
  }
  
  
   // edges function that wrap out the vector to ensure that vectors return on screen 
  edges() 
  {
    if (this.position.x > width) 
    {
      this.position.x = 0;
    } else if (this.position.x < 0) 
    {
      this.position.x = width;
    }
    if (this.position.y > height) 
    {
      this.position.y = 0;
    } else if (this.position.y < 0)
    {
      this.position.y = height;
    }
  }
}


/* The below code of the class AlgaeEater is based on tutorial "5.2 Seeking a Target - The Nature of Code" available on Coding Train youtube platform and it's author is Daniel Shiffman. This turtorial is available at the following link: https://www.youtube.com/watch?v=p1Ws1ZhG36g. I have coded along the turtorial and readapted the rewritten code.*/
class AlgaeEater 
{
  constructor(x, y) 
  {
    this.pos = createVector(x, y);
    this.vel = createVector(0, 0);
    this.acc = createVector(0, 0);
    this.maxSpeed = 5;
    
    // maxForce is a variable that limit the steering force
    this.maxForce = 0.2;
    this.r = 16;
  }
  
 seek(target) 
  {
    let force = p5.Vector.sub(target, this.pos);
    force.setMag(this.maxSpeed);
    force.sub(this.vel);
    force.limit(this.maxForce);
    this.applyForce(force);
  }

  update() 
  {
    this.vel.add(this.acc);
    this.vel.limit(this.maxSpeed);
    this.pos.add(this.vel);
    this.acc.mult(0);
  }
  
    applyForce(force) 
  {
    this.acc.add(force);
  } 

  show(colour) 
  {
    stroke(colour+100,180 -colour,255,150);
    noStroke();
    fill(100%colour,250 -colour,255,180);
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.vel.heading());
    triangle(-this.r/4, -this.r / 2, -this.r, this.r / 2, this.r, 0);
    rect(-this.r/2, -this.r / 4, this.r);
    ellipse(this.r/2, -this.r / 2,this.r);
    pop();
  }

  // edges function that wrap out the vector to ensure that vectors return on screen
  edges() 
  {
    if (this.pos.x > width + this.r) {
      this.pos.x = -this.r;
    } else if (this.pos.x < -this.r) {
      this.pos.x = width + this.r;
    }
    if (this.pos.y > height + this.r) {
      this.pos.y = -this.r;
    } else if (this.pos.y < -this.r) {
      this.pos.y = height + this.r;
    }
  }
  
  // eat function that make use of seek behaviour define above
  eat(list){
  var record = Infinity;
  var closestIndex= -1;
  for( var i=0; i< list.length; i++) {
  // locola variable distance to store a calculated distance between tthis AlgaeEater and the object form the array list
  var distance = this.pos.dist(list[i]);
  // conditional statement chechking if distance is smaller than infinity
  if ( distance< record){
      record = distance; // assigning record to distance; starting with an Infinity and decreasing it's value to find all object from the array list
      closestIndex = i; // assigning closestIndex to i, to store the index within this variable; as per next step, this will be removed from the array
    }
  }
  if(record<5){
    // using a splice function to remove the index from the Array , stored at the closest Index; provided that the record is smaller than 5
    list.splice(closestIndex,1);
  }
    // prevents from an error, ensure that vehicle keeps on seeking a target
    else if (closestIndex > -1) {
    this.seek(list[closestIndex]);
    }
  }
}