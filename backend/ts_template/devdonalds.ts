import express, { Request, Response } from "express";

// ==== Type Definitions, feel free to add or modify ==========================
interface cookbookEntry {
  name: string;
  type: string;
}

interface requiredItem {
  name: string;
  quantity: number;
}

interface recipe extends cookbookEntry {
  requiredItems: requiredItem[];
}

interface ingredient extends cookbookEntry {
  cookTime: number;
}

interface recipeSummary {
  name: string;
  cookTime: number;
  ingredients: requiredItem[];
}

// =============================================================================
// ==== HTTP Endpoint Stubs ====================================================
// =============================================================================
const app = express();
app.use(express.json());

// Store your recipes here!
const cookbook: recipe | ingredient[] = [];

// Task 1 helper (don't touch)
app.post("/parse", (req:Request, res:Response) => {
  const { input } = req.body;

  const parsed_string = parse_handwriting(input)
  if (parsed_string == null) {
    res.status(400).send("this string is cooked");
    return;
  } 
  res.json({ msg: parsed_string });
  return;
  
});

// [TASK 1] ====================================================================
// Takes in a recipeName and returns it in a form that 
const parse_handwriting = (recipeName: string): string | null => {
  // Replace underscore and hyphens with whitespace
  let parsed = recipeName.replace(/[-_]/g, " ");

  // Remove characters that are not letters or whitespace
  parsed = parsed.replace(/[^A-Za-z\s\-_]/g, "");

  // Capitalise each word
  // Note: Since I have already replaced underscores, hyphens with whitespace, I only need to check whether the words are 
  // separated by whitespace
  parsed = parsed.toLowerCase();
  parsed = parsed.replace(/\b\w/g, char => char.toUpperCase());

  // Replace multiple whitespaces with 1 whitespace and remove trailing or leading whitespace
  parsed = parsed.replace(/\s+/g, ' ').trim();

  if (recipeName.length <= 0) {
    return null;
  }

  return parsed;
}

// [TASK 2] ====================================================================
// Endpoint that adds a CookbookEntry to your magical cookbook
app.post("/entry", (req:Request, res:Response) => {
  const cookbookEntry = req.body;

  // type can only be "recipe" or "ingredient"
  if (cookbookEntry.type != "recipe" && cookbookEntry.type != "ingredient") {
    return res.status(400).send("Type of entry must be either recipe or ingredient");
  }

  // cookTime can only be greater than or equal to 0
  if (cookbookEntry.cookTime < 0) {
    return res.status(400).send("Cooking time must be greater than or equal to 0");
  }
  
  // entry names must be unique
  if (cookbook.some(entry => entry.name == cookbookEntry.name)) {
    return res.status(400).send("Entry must have a unique name");
  }

  // Recipe requiredItems can only have one element per name
  if (!checkUniqueElement(cookbookEntry)) {
    return res.status(400).send("Recipe requireItems has elements with the same name");
  }

  cookbook.push(cookbookEntry);

  res.status(200).send();
})


// Checks if the new cookbook entry is unique 
const checkUniqueElement = (entry: cookbookEntry): boolean => {
  if (entry.type === "ingredient") {
    return true; 
  }

  const recipe = entry as recipe;
  if (!recipe.requiredItems || recipe.requiredItems.length === 0) {
    return true; 
  }

  // Check there is only 1 of every recipe requiredItems' name
  const itemNames = recipe.requiredItems.map(item => item.name);
  const uniqueItemNames = new Set(itemNames);

  return itemNames.length === uniqueItemNames.size;  
}

// [TASK 3] ====================================================================
// Endpoint that returns a summary of a recipe that corresponds to a query name
app.get("/summary", (req:Request, res:Request) => {
  // NOTE: Some parts of this task is not working
  const recipeName = req.query.name as string;

  // A recipe with the corresponding name cannot be found
  if (!cookbook.find(entry => entry.name == recipeName)) {
    return res.status(400).send("Recipe with corresponding name could not be found");
  }

  // const recipe = cookbook.find(entry => entry.name === recipeName && entry.type === 'recipe') as recipe;
  const recipe = cookbook.find(i => i.name == recipeName);
  // The searched name is NOT a recipe name (ie. an ingredient)
  if (recipe.type !== "recipe") {
    return res.status(400).send("The searched name is NOT a recipe name");
  }

  // The recipe contains recipes or ingredients that aren't in the cookbook


  const ingredientsList = []

  getAllIngredients(recipe, ingredientsList);

  // There is type mismatch that I wasn't able to fix so i just passed recipe as null
  const recipeSummary = getRecipeSummary(recipeName, ingredientsList, null);

  res.status(200).json(recipeSummary);
});

// Function to recursively find "children" ingredients to create the ingredients summary
const getAllIngredients = (component: recipe | ingredient, ingredientList: requiredItem[] = [], quantity: number = 1): requiredItem[] => {
  // Base case
  if (component.type == "ingredient") {
    const existingIngredient = ingredientList.find(i => i.name === component.name);
    if (existingIngredient){
        existingIngredient.quantity += quantity;
    } else {
        ingredientList.push({name: component.name, quantity: quantity});
    }
    return ingredientList;
  }

  const recipeComponent = component as recipe;

  // Recurse through children
  for (const item of recipeComponent.requiredItems) {
    const cookbookItem = cookbook.find(i => item.name == i.name);
    ingredientList = getAllIngredients(cookbookItem, ingredientList, item.quantity * quantity);
  }

  return ingredientList;
}

const getRecipeSummary = (recipeName: string, ingredientList: requiredItem[], recipe: recipe): recipeSummary => {
  const updatedIngredientQuantities = updateIngredientsQuantities(ingredientList, recipe);
  let totalCookTime = 0;

  updatedIngredientQuantities.forEach(ingredient => {
    // Find the ingredient object in the cookbook to get its cookTime
    const cookbookIngredient = cookbook.find(i => i.name === ingredient.name && i.type === 'ingredient') as ingredient;

    if (cookbookIngredient) {
      // Multiply the cookTime by the updated quantity
      totalCookTime += cookbookIngredient.cookTime * ingredient.quantity;
    }
  });

  return {
    name: recipeName,
    cookTime: totalCookTime,
    ingredients: updatedIngredientQuantities
  };
};

const updateIngredientsQuantities = (ingredientList: requiredItem[], recipe: recipe): requiredItem[] => {
  const newList = [];
  const ingredientCounts = {};

  // Count ingredient occurrences from the recipe's requiredItems
  const countIngredients = (recipe: recipe) => {
    for (const item of recipe.requiredItems) {
      if (ingredientCounts[item.name]) {
        ingredientCounts[item.name] += item.quantity;
      } else {
        ingredientCounts[item.name] = item.quantity;
      }

      // Check for nested recipes and count their ingredients.
      // const nestedRecipe = cookbook.find(entry => entry.name === item.name && entry.type === 'recipe') as recipe;
      // if (nestedRecipe) {
      //   countIngredients(nestedRecipe);
      // }
    }
  };

  countIngredients(recipe);

  // Convert ingredient counts to requiredItem objects
  for (const name in ingredientCounts) {
    newList.push({ name, quantity: ingredientCounts[name] });
  }

  return newList;
};

// =============================================================================
// ==== DO NOT TOUCH ===========================================================
// =============================================================================
const port = 8080;
app.listen(port, () => {
  console.log(`Running on: http://127.0.0.1:8080`);
});
