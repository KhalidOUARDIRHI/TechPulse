import uvicorn

if __name__ == "__main__":
    # Exécution de l'application avec uvicorn
    uvicorn.run(
        "app.main:app", 
        host="0.0.0.0", 
        port=8000, 
        reload=True
    ) 