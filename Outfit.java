import java.util.ArrayList;

public class Outfit {
    private String nombre;
    private String ocasion;
    private ArrayList<Prenda> prendas;

    public Outfit(String nombre, String ocasion) {
        this.nombre = nombre;
        this.ocasion = ocasion;
        this.prendas = new ArrayList<>();
    }

    public void agregarPrenda(Prenda prenda) {
        prendas.add(prenda);
    }

    public String getNombre() {
        return nombre;
    }

    public String getOcasion() {
        return ocasion;
    }

    public ArrayList<Prenda> getPrendas() {
        return prendas;
    }
}