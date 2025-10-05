body {
    font-family: Arial, sans-serif;
    background-color: #f4f4f4;
    margin: 0;
    padding: 20px;
}

.container {
    max-width: 600px;
    margin: auto;
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 0 10px rgba(0,0,0,0.1);
}

h1, h2, h3 {
    text-align: center;
}

input {
    margin: 5px;
    padding: 8px;
    width: 200px;
}

button {
    padding: 8px 16px;
    background-color: #4CAF50;
    color: white;
    border: none;
    cursor: pointer;
}

button:hover {
    background-color: #45a049;
}

ul {
    list-style-type: none;
    padding: 0;
}

li {
    background: #eee;
    margin: 5px 0;
    padding: 10px;
    border-radius: 4px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.redeem-btn {
    background-color: #2196F3;
    color: white;
    padding: 5px 10px;
    border: none;
    cursor: pointer;
}

.redeem-btn:disabled {
    background-color: #ccc;
    cursor: not-allowed;
}
